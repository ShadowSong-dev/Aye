import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { getAddress, parseEventLogs, zeroAddress } from "viem";

describe("AuditLogFactory", async () => {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();

  let factory: Awaited<ReturnType<typeof viem.deployContract<"AuditLogFactory">>>;
  let deployer: Awaited<ReturnType<typeof viem.getWalletClients>>[number];
  let alice: Awaited<ReturnType<typeof viem.getWalletClients>>[number];
  let bob: Awaited<ReturnType<typeof viem.getWalletClients>>[number];
  let stranger: Awaited<ReturnType<typeof viem.getWalletClients>>[number];

  beforeEach(async () => {
    const wallets = await viem.getWalletClients();
    deployer = wallets[0];
    alice = wallets[1];
    bob = wallets[2];
    stranger = wallets[3];

    factory = await viem.deployContract("AuditLogFactory", []);
  });

  describe("deployedFor mapping", () => {
    it("returns the zero address for an owner with no deployment", async () => {
      assert.equal(
        await factory.read.deployedFor([alice.account.address]),
        zeroAddress,
      );
    });
  });

  describe("deploy (happy path)", () => {
    it("records the new AuditLog in deployedFor", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      const stored = await factory.read.deployedFor([alice.account.address]);
      assert.notEqual(stored, zeroAddress);
    });

    it("deploys real contract bytecode at the recorded address", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      const stored = await factory.read.deployedFor([alice.account.address]);
      const code = await publicClient.getCode({ address: stored });
      assert.ok(code !== undefined && code !== "0x");
    });

    it("deployed AuditLog reports the requested initial owner", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      const stored = await factory.read.deployedFor([alice.account.address]);
      const auditLog = await viem.getContractAt("AuditLog", stored);
      assert.equal(
        getAddress(await auditLog.read.owner()),
        getAddress(alice.account.address),
      );
    });

    it("emits AuditLogDeployed with (owner, deployedAddress)", async () => {
      const txHash = await factory.write.deploy(
        [alice.account.address],
        { account: deployer.account },
      );
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      const stored = await factory.read.deployedFor([alice.account.address]);

      const logs = parseEventLogs({
        abi: factory.abi,
        logs: receipt.logs,
        eventName: "AuditLogDeployed",
      });
      assert.equal(logs.length, 1);
      assert.equal(
        getAddress(logs[0].args.owner),
        getAddress(alice.account.address),
      );
      assert.equal(getAddress(logs[0].args.auditLog), getAddress(stored));
    });

    it("can be called by any sender — msg.sender is not authorization", async () => {
      await factory.write.deploy([alice.account.address], { account: stranger.account });
      assert.notEqual(
        await factory.read.deployedFor([alice.account.address]),
        zeroAddress,
      );
    });

    it("the AuditLog owner is the requested address, not msg.sender", async () => {
      await factory.write.deploy([alice.account.address], { account: bob.account });
      const stored = await factory.read.deployedFor([alice.account.address]);
      const auditLog = await viem.getContractAt("AuditLog", stored);
      assert.equal(
        getAddress(await auditLog.read.owner()),
        getAddress(alice.account.address),
      );
    });

    it("deploys distinct AuditLogs for distinct owners", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      await factory.write.deploy([bob.account.address], { account: deployer.account });

      const a = await factory.read.deployedFor([alice.account.address]);
      const b = await factory.read.deployedFor([bob.account.address]);

      assert.notEqual(a, zeroAddress);
      assert.notEqual(b, zeroAddress);
      assert.notEqual(getAddress(a), getAddress(b));
    });
  });

  describe("deploy (revert paths)", () => {
    it("reverts with ZeroAddress when owner is the zero address", async () => {
      await viem.assertions.revertWithCustomError(
        factory.write.deploy([zeroAddress], { account: deployer.account }),
        factory,
        "ZeroAddress",
      );
    });

    it("reverts with AlreadyDeployed on a second call for the same owner", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      await viem.assertions.revertWithCustomError(
        factory.write.deploy([alice.account.address], { account: deployer.account }),
        factory,
        "AlreadyDeployed",
      );
    });

    it("AlreadyDeployed carries the existing AuditLog as its argument", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      const existing = await factory.read.deployedFor([alice.account.address]);

      await viem.assertions.revertWithCustomErrorWithArgs(
        factory.write.deploy([alice.account.address], { account: deployer.account }),
        factory,
        "AlreadyDeployed",
        [getAddress(existing)],
      );
    });

    it("AlreadyDeployed applies regardless of which sender retries", async () => {
      await factory.write.deploy([alice.account.address], { account: bob.account });
      await viem.assertions.revertWithCustomError(
        factory.write.deploy([alice.account.address], { account: stranger.account }),
        factory,
        "AlreadyDeployed",
      );
    });

    it("does not change deployedFor on a reverted re-deploy attempt", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      const before = await factory.read.deployedFor([alice.account.address]);

      await viem.assertions.revertWithCustomError(
        factory.write.deploy([alice.account.address], { account: deployer.account }),
        factory,
        "AlreadyDeployed",
      );

      const after = await factory.read.deployedFor([alice.account.address]);
      assert.equal(getAddress(before), getAddress(after));
    });
  });

  describe("integration: deployed AuditLog is functional", () => {
    it("the requested owner can mutate the inherited Whitelist", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      const stored = await factory.read.deployedFor([alice.account.address]);
      const auditLog = await viem.getContractAt("AuditLog", stored);

      await auditLog.write.addAddress([bob.account.address], { account: alice.account });
      assert.equal(
        await auditLog.read.isWhitelisted([bob.account.address]),
        true,
      );
    });

    it("the factory deployer cannot mutate the deployed AuditLog's whitelist", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      const stored = await factory.read.deployedFor([alice.account.address]);
      const auditLog = await viem.getContractAt("AuditLog", stored);

      await viem.assertions.revertWithCustomError(
        auditLog.write.addAddress([bob.account.address], { account: deployer.account }),
        auditLog,
        "NotOwner",
      );
    });

    it("two AuditLogs from the same factory have independent whitelist state", async () => {
      await factory.write.deploy([alice.account.address], { account: deployer.account });
      await factory.write.deploy([bob.account.address], { account: deployer.account });

      const aliceLog = await viem.getContractAt(
        "AuditLog",
        await factory.read.deployedFor([alice.account.address]),
      );
      const bobLog = await viem.getContractAt(
        "AuditLog",
        await factory.read.deployedFor([bob.account.address]),
      );

      await aliceLog.write.addAddress([stranger.account.address], { account: alice.account });
      assert.equal(await aliceLog.read.isWhitelisted([stranger.account.address]), true);
      assert.equal(await bobLog.read.isWhitelisted([stranger.account.address]), false);
    });
  });
});
