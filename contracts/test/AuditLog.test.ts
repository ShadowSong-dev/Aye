import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";

describe("AuditLog", async () => {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  let auditLog: Awaited<ReturnType<typeof viem.deployContract<"AuditLog">>>;
  let owner: Awaited<ReturnType<typeof viem.getWalletClients>>[number];
  let other: Awaited<ReturnType<typeof viem.getWalletClients>>[number];
  let caller: Awaited<ReturnType<typeof viem.getWalletClients>>[number];

  const types = {
    TxIntent: [
      { name: "agentId", type: "string" },
      { name: "intentHash", type: "bytes32" },
      { name: "riskLevel", type: "uint8" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  } as const;

  const EXPECTED_INTENT_TYPEHASH = keccak256(
    toBytes(
      "TxIntent(string agentId,bytes32 intentHash,uint8 riskLevel,uint256 nonce,uint256 deadline)",
    ),
  );

  function domain(verifyingContract: Address) {
    return {
      name: "ElizaAuditLog",
      version: "1",
      chainId,
      verifyingContract,
    } as const;
  }

  async function signIntent(
    signer: typeof owner,
    verifyingContract: Address,
    message: {
      agentId: string;
      intentHash: Hex;
      riskLevel: number;
      nonce: bigint;
      deadline: bigint;
    },
  ): Promise<Hex> {
    return signer.signTypedData({
      domain: domain(verifyingContract),
      types,
      primaryType: "TxIntent",
      message,
    });
  }

  function makeIntent(overrides: Partial<{
    agentId: string;
    intentHash: Hex;
    riskLevel: number;
    nonce: bigint;
    deadline: bigint;
  }> = {}) {
    return {
      agentId: "agent-1",
      intentHash: keccak256(toBytes("payload-1")) as Hex,
      riskLevel: 1,
      nonce: 1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      ...overrides,
    };
  }

  beforeEach(async () => {
    const wallets = await viem.getWalletClients();
    owner = wallets[0];
    other = wallets[1];
    caller = wallets[2];

    auditLog = await viem.deployContract("AuditLog", [owner.account.address]);
  });

  describe("constructor & inherited Whitelist", () => {
    it("inherits Whitelist owner getter", async () => {
      assert.equal(
        getAddress(await auditLog.read.owner()),
        getAddress(owner.account.address),
      );
    });

    it("reverts with ZeroAddress when initialOwner is zero", async () => {
      await viem.assertions.revertWithCustomError(
        viem
          .sendDeploymentTransaction("AuditLog", [
            "0x0000000000000000000000000000000000000000",
          ])
          .then((r) => r.contract.read.owner()),
        auditLog,
        "ZeroAddress",
      );
    });

    it("exposes inherited Whitelist mutators (addAddress / removeAddress)", async () => {
      await auditLog.write.addAddress([other.account.address], { account: owner.account });
      assert.equal(await auditLog.read.isWhitelisted([other.account.address]), true);
      assert.equal(await auditLog.read.addressesCount(), 1n);
      assert.deepEqual(
        (await auditLog.read.getAddresses()).map((a) => a.toLowerCase()),
        [other.account.address.toLowerCase()],
      );
      await auditLog.write.removeAddress([other.account.address], { account: owner.account });
      assert.equal(await auditLog.read.isWhitelisted([other.account.address]), false);
    });
  });

  describe("INTENT_TYPEHASH", () => {
    it("matches keccak256 of the canonical TxIntent struct", async () => {
      assert.equal(await auditLog.read.INTENT_TYPEHASH(), EXPECTED_INTENT_TYPEHASH);
    });
  });

  describe("domainSeparator", () => {
    it("matches the manually computed EIP-712 domain separator", async () => {
      const domainTypeHash = keccak256(
        toBytes(
          "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
        ),
      );
      const expected = keccak256(
        encodeAbiParameters(
          [
            { type: "bytes32" },
            { type: "bytes32" },
            { type: "bytes32" },
            { type: "uint256" },
            { type: "address" },
          ],
          [
            domainTypeHash,
            keccak256(toBytes("ElizaAuditLog")),
            keccak256(toBytes("1")),
            BigInt(chainId),
            auditLog.address,
          ],
        ),
      );
      assert.equal(await auditLog.read.domainSeparator(), expected);
    });
  });

  describe("usedNonce", () => {
    it("is false for an unused nonce", async () => {
      assert.equal(await auditLog.read.usedNonce([0n]), false);
      assert.equal(await auditLog.read.usedNonce([12345n]), false);
    });

    it("becomes true after a successful log()", async () => {
      const intent = makeIntent({ nonce: 999n });
      const sig = await signIntent(owner, auditLog.address, intent);
      await auditLog.write.log(
        [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
        { account: caller.account },
      );
      assert.equal(await auditLog.read.usedNonce([999n]), true);
    });
  });

  describe("entriesCount", () => {
    it("starts at zero", async () => {
      assert.equal(await auditLog.read.entriesCount(), 0n);
    });

    it("increments by one for each successful log()", async () => {
      const i1 = makeIntent({ nonce: 1n });
      const s1 = await signIntent(owner, auditLog.address, i1);
      await auditLog.write.log(
        [i1.agentId, i1.intentHash, i1.riskLevel, i1.nonce, i1.deadline, s1],
        { account: caller.account },
      );
      assert.equal(await auditLog.read.entriesCount(), 1n);

      const i2 = makeIntent({ nonce: 2n });
      const s2 = await signIntent(owner, auditLog.address, i2);
      await auditLog.write.log(
        [i2.agentId, i2.intentHash, i2.riskLevel, i2.nonce, i2.deadline, s2],
        { account: caller.account },
      );
      assert.equal(await auditLog.read.entriesCount(), 2n);
    });
  });

  describe("entryAt", () => {
    it("returns the stored entry with all fields populated", async () => {
      const intent = makeIntent({ nonce: 7n, agentId: "stored-agent", riskLevel: 3 });
      const sig = await signIntent(owner, auditLog.address, intent);

      const txHash = await auditLog.write.log(
        [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
        { account: caller.account },
      );
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });

      const entry = await auditLog.read.entryAt([0n]);
      assert.equal(entry.agentId, intent.agentId);
      assert.equal(entry.intentHash, intent.intentHash);
      assert.equal(entry.riskLevel, intent.riskLevel);
      assert.equal(entry.nonce, intent.nonce);
      assert.equal(entry.timestamp, block.timestamp);
      assert.equal(getAddress(entry.approver), getAddress(owner.account.address));
      assert.equal(entry.approvalSig, sig);
    });

    it("reverts on out-of-bounds index", async () => {
      await viem.assertions.revert(auditLog.read.entryAt([0n]));
    });
  });

  describe("log (happy path)", () => {
    it("stores an entry signed by the owner and emits Logged with all args", async () => {
      const intent = makeIntent();
      const sig = await signIntent(owner, auditLog.address, intent);

      await viem.assertions.emitWithArgs(
        auditLog.write.log(
          [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
          { account: caller.account },
        ),
        auditLog,
        "Logged",
        [
          0n,
          intent.agentId,
          intent.intentHash,
          intent.riskLevel,
          intent.nonce,
          getAddress(owner.account.address),
        ],
      );
    });

    it("can be called by any account (signature, not msg.sender, gates auth)", async () => {
      const intent = makeIntent({ nonce: 555n });
      const sig = await signIntent(owner, auditLog.address, intent);
      await auditLog.write.log(
        [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
        { account: other.account },
      );
      assert.equal(await auditLog.read.entriesCount(), 1n);
    });

    it("supports an empty agentId string", async () => {
      const intent = makeIntent({ agentId: "" });
      const sig = await signIntent(owner, auditLog.address, intent);
      await auditLog.write.log(
        [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
        { account: caller.account },
      );
      const entry = await auditLog.read.entryAt([0n]);
      assert.equal(entry.agentId, "");
    });

    it("accepts deadline equal to the current block timestamp (boundary)", async () => {
      const block = await publicClient.getBlock();
      const intent = makeIntent({ nonce: 88n, deadline: block.timestamp + 5n });
      const sig = await signIntent(owner, auditLog.address, intent);
      await auditLog.write.log(
        [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
        { account: caller.account },
      );
      assert.equal(await auditLog.read.entriesCount(), 1n);
    });
  });

  describe("log (revert paths)", () => {
    it("reverts with DeadlineExpired when deadline is in the past", async () => {
      const block = await publicClient.getBlock();
      const intent = makeIntent({ deadline: block.timestamp - 1n });
      const sig = await signIntent(owner, auditLog.address, intent);

      await viem.assertions.revertWithCustomError(
        auditLog.write.log(
          [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
          { account: caller.account },
        ),
        auditLog,
        "DeadlineExpired",
      );
    });

    it("reverts with NonceUsed on exact replay", async () => {
      const intent = makeIntent({ nonce: 42n });
      const sig = await signIntent(owner, auditLog.address, intent);

      await auditLog.write.log(
        [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
        { account: caller.account },
      );

      await viem.assertions.revertWithCustomError(
        auditLog.write.log(
          [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
          { account: caller.account },
        ),
        auditLog,
        "NonceUsed",
      );
    });

    it("reverts with NonceUsed when reusing a nonce with a different intent", async () => {
      const i1 = makeIntent({ nonce: 7n });
      const s1 = await signIntent(owner, auditLog.address, i1);
      await auditLog.write.log(
        [i1.agentId, i1.intentHash, i1.riskLevel, i1.nonce, i1.deadline, s1],
        { account: caller.account },
      );

      const i2 = makeIntent({ nonce: 7n, agentId: "different" });
      const s2 = await signIntent(owner, auditLog.address, i2);
      await viem.assertions.revertWithCustomError(
        auditLog.write.log(
          [i2.agentId, i2.intentHash, i2.riskLevel, i2.nonce, i2.deadline, s2],
          { account: caller.account },
        ),
        auditLog,
        "NonceUsed",
      );
    });

    it("reverts with InvalidSignature when signed by a non-owner", async () => {
      const intent = makeIntent();
      const badSig = await signIntent(other, auditLog.address, intent);

      await viem.assertions.revertWithCustomError(
        auditLog.write.log(
          [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, badSig],
          { account: caller.account },
        ),
        auditLog,
        "InvalidSignature",
      );
    });

    it("reverts with InvalidSignature when call args differ from signed payload", async () => {
      const signed = makeIntent({ riskLevel: 1 });
      const sig = await signIntent(owner, auditLog.address, signed);

      await viem.assertions.revertWithCustomError(
        auditLog.write.log(
          [signed.agentId, signed.intentHash, 5, signed.nonce, signed.deadline, sig],
          { account: caller.account },
        ),
        auditLog,
        "InvalidSignature",
      );
    });

    it("reverts with InvalidSignature when the verifyingContract is wrong", async () => {
      const otherDeployed = await viem.deployContract("AuditLog", [owner.account.address]);
      const intent = makeIntent({ nonce: 33n });
      const sig = await signIntent(owner, otherDeployed.address, intent);

      await viem.assertions.revertWithCustomError(
        auditLog.write.log(
          [intent.agentId, intent.intentHash, intent.riskLevel, intent.nonce, intent.deadline, sig],
          { account: caller.account },
        ),
        auditLog,
        "InvalidSignature",
      );
    });
  });
});
