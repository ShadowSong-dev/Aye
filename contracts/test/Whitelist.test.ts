import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { getAddress, zeroAddress } from "viem";

describe("Whitelist", async () => {
  const { viem } = await network.create();

  let whitelist: Awaited<ReturnType<typeof viem.deployContract<"Whitelist">>>;
  let owner: Awaited<ReturnType<typeof viem.getWalletClients>>[number];
  let other: Awaited<ReturnType<typeof viem.getWalletClients>>[number];
  let alice: Awaited<ReturnType<typeof viem.getWalletClients>>[number];
  let bob: Awaited<ReturnType<typeof viem.getWalletClients>>[number];
  let stranger: Awaited<ReturnType<typeof viem.getWalletClients>>[number];

  beforeEach(async () => {
    const wallets = await viem.getWalletClients();
    owner = wallets[0];
    other = wallets[1];
    alice = wallets[2];
    bob = wallets[3];
    stranger = wallets[4];

    whitelist = await viem.deployContract("Whitelist", [owner.account.address]);
  });

  describe("constructor & owner()", () => {
    it("sets the initial owner", async () => {
      assert.equal(
        getAddress(await whitelist.read.owner()),
        getAddress(owner.account.address),
      );
    });

    it("reverts when initialOwner is the zero address", async () => {
      await viem.assertions.revertWithCustomError(
        viem
          .sendDeploymentTransaction("Whitelist", [zeroAddress])
          .then((r) => r.contract.read.owner()),
        whitelist,
        "ZeroAddress",
      );
    });
  });

  describe("addAddress", () => {
    it("adds an address and emits AddressAdded", async () => {
      await viem.assertions.emitWithArgs(
        whitelist.write.addAddress([alice.account.address], { account: owner.account }),
        whitelist,
        "AddressAdded",
        [getAddress(alice.account.address)],
      );
      assert.equal(await whitelist.read.isWhitelisted([alice.account.address]), true);
      assert.equal(await whitelist.read.addressesCount(), 1n);
    });

    it("reverts with NotOwner when called by a non-owner", async () => {
      await viem.assertions.revertWithCustomError(
        whitelist.write.addAddress([alice.account.address], { account: other.account }),
        whitelist,
        "NotOwner",
      );
    });

    it("reverts with ZeroAddress when adding zero address", async () => {
      await viem.assertions.revertWithCustomError(
        whitelist.write.addAddress([zeroAddress], { account: owner.account }),
        whitelist,
        "ZeroAddress",
      );
    });

    it("reverts with AlreadyWhitelisted when re-adding", async () => {
      await whitelist.write.addAddress([alice.account.address], { account: owner.account });
      await viem.assertions.revertWithCustomError(
        whitelist.write.addAddress([alice.account.address], { account: owner.account }),
        whitelist,
        "AlreadyWhitelisted",
      );
    });
  });

  describe("removeAddress", () => {
    beforeEach(async () => {
      await whitelist.write.addAddresses(
        [[alice.account.address, bob.account.address, other.account.address]],
        { account: owner.account },
      );
    });

    it("removes an address and emits AddressRemoved", async () => {
      await viem.assertions.emitWithArgs(
        whitelist.write.removeAddress([alice.account.address], { account: owner.account }),
        whitelist,
        "AddressRemoved",
        [getAddress(alice.account.address)],
      );
      assert.equal(await whitelist.read.isWhitelisted([alice.account.address]), false);
      assert.equal(await whitelist.read.addressesCount(), 2n);
    });

    it("preserves remaining entries via swap-and-pop", async () => {
      await whitelist.write.removeAddress([alice.account.address], { account: owner.account });
      const remaining = (await whitelist.read.getAddresses()).map((a) => a.toLowerCase());
      assert.deepEqual(remaining.sort(), [
        bob.account.address.toLowerCase(),
        other.account.address.toLowerCase(),
      ].sort());
    });

    it("can remove the last address without reordering", async () => {
      await whitelist.write.removeAddress([other.account.address], { account: owner.account });
      const remaining = (await whitelist.read.getAddresses()).map((a) => a.toLowerCase());
      assert.deepEqual(remaining, [
        alice.account.address.toLowerCase(),
        bob.account.address.toLowerCase(),
      ]);
    });

    it("can remove all entries down to empty", async () => {
      await whitelist.write.removeAddresses(
        [[alice.account.address, bob.account.address, other.account.address]],
        { account: owner.account },
      );
      assert.equal(await whitelist.read.addressesCount(), 0n);
      assert.deepEqual(await whitelist.read.getAddresses(), []);
    });

    it("allows re-adding a previously removed address", async () => {
      await whitelist.write.removeAddress([alice.account.address], { account: owner.account });
      await whitelist.write.addAddress([alice.account.address], { account: owner.account });
      assert.equal(await whitelist.read.isWhitelisted([alice.account.address]), true);
      assert.equal(await whitelist.read.addressesCount(), 3n);
    });

    it("reverts with NotOwner when called by a non-owner", async () => {
      await viem.assertions.revertWithCustomError(
        whitelist.write.removeAddress([alice.account.address], { account: other.account }),
        whitelist,
        "NotOwner",
      );
    });

    it("reverts with NotWhitelisted for an unknown address", async () => {
      await viem.assertions.revertWithCustomError(
        whitelist.write.removeAddress([stranger.account.address], { account: owner.account }),
        whitelist,
        "NotWhitelisted",
      );
    });
  });

  describe("addAddresses", () => {
    it("adds many entries in a single call", async () => {
      await whitelist.write.addAddresses(
        [[alice.account.address, bob.account.address]],
        { account: owner.account },
      );
      assert.equal(await whitelist.read.addressesCount(), 2n);
      assert.equal(await whitelist.read.isWhitelisted([alice.account.address]), true);
      assert.equal(await whitelist.read.isWhitelisted([bob.account.address]), true);
    });

    it("accepts an empty array as a no-op", async () => {
      await whitelist.write.addAddresses([[]], { account: owner.account });
      assert.equal(await whitelist.read.addressesCount(), 0n);
    });

    it("reverts with NotOwner for a non-owner", async () => {
      await viem.assertions.revertWithCustomError(
        whitelist.write.addAddresses(
          [[alice.account.address]],
          { account: other.account },
        ),
        whitelist,
        "NotOwner",
      );
    });

    it("reverts atomically with AlreadyWhitelisted on a duplicate within the batch", async () => {
      await viem.assertions.revertWithCustomError(
        whitelist.write.addAddresses(
          [[alice.account.address, alice.account.address]],
          { account: owner.account },
        ),
        whitelist,
        "AlreadyWhitelisted",
      );
      assert.equal(await whitelist.read.addressesCount(), 0n);
      assert.equal(await whitelist.read.isWhitelisted([alice.account.address]), false);
    });

    it("reverts with ZeroAddress if any element is zero", async () => {
      await viem.assertions.revertWithCustomError(
        whitelist.write.addAddresses(
          [[alice.account.address, zeroAddress]],
          { account: owner.account },
        ),
        whitelist,
        "ZeroAddress",
      );
    });
  });

  describe("removeAddresses", () => {
    beforeEach(async () => {
      await whitelist.write.addAddresses(
        [[alice.account.address, bob.account.address, other.account.address]],
        { account: owner.account },
      );
    });

    it("removes many entries in a single call", async () => {
      await whitelist.write.removeAddresses(
        [[alice.account.address, bob.account.address]],
        { account: owner.account },
      );
      assert.equal(await whitelist.read.addressesCount(), 1n);
      assert.equal(await whitelist.read.isWhitelisted([alice.account.address]), false);
      assert.equal(await whitelist.read.isWhitelisted([bob.account.address]), false);
      assert.equal(await whitelist.read.isWhitelisted([other.account.address]), true);
    });

    it("accepts an empty array as a no-op", async () => {
      await whitelist.write.removeAddresses([[]], { account: owner.account });
      assert.equal(await whitelist.read.addressesCount(), 3n);
    });

    it("reverts with NotOwner for a non-owner", async () => {
      await viem.assertions.revertWithCustomError(
        whitelist.write.removeAddresses(
          [[alice.account.address]],
          { account: other.account },
        ),
        whitelist,
        "NotOwner",
      );
    });

    it("reverts with NotWhitelisted if any element is not whitelisted", async () => {
      await viem.assertions.revertWithCustomError(
        whitelist.write.removeAddresses(
          [[alice.account.address, stranger.account.address]],
          { account: owner.account },
        ),
        whitelist,
        "NotWhitelisted",
      );
    });
  });

  describe("isWhitelisted", () => {
    it("returns false for an address that was never added", async () => {
      assert.equal(await whitelist.read.isWhitelisted([alice.account.address]), false);
    });

    it("returns true after adding and false after removing", async () => {
      await whitelist.write.addAddress([alice.account.address], { account: owner.account });
      assert.equal(await whitelist.read.isWhitelisted([alice.account.address]), true);
      await whitelist.write.removeAddress([alice.account.address], { account: owner.account });
      assert.equal(await whitelist.read.isWhitelisted([alice.account.address]), false);
    });

    it("returns false for the zero address", async () => {
      assert.equal(await whitelist.read.isWhitelisted([zeroAddress]), false);
    });
  });

  describe("getAddresses", () => {
    it("returns an empty array initially", async () => {
      assert.deepEqual(await whitelist.read.getAddresses(), []);
    });

    it("reflects insertion order before any removal", async () => {
      await whitelist.write.addAddress([alice.account.address], { account: owner.account });
      await whitelist.write.addAddress([bob.account.address], { account: owner.account });
      const list = (await whitelist.read.getAddresses()).map((a) => a.toLowerCase());
      assert.deepEqual(list, [
        alice.account.address.toLowerCase(),
        bob.account.address.toLowerCase(),
      ]);
    });
  });

  describe("addressesCount", () => {
    it("starts at zero", async () => {
      assert.equal(await whitelist.read.addressesCount(), 0n);
    });

    it("increments on add and decrements on remove", async () => {
      await whitelist.write.addAddress([alice.account.address], { account: owner.account });
      assert.equal(await whitelist.read.addressesCount(), 1n);
      await whitelist.write.addAddress([bob.account.address], { account: owner.account });
      assert.equal(await whitelist.read.addressesCount(), 2n);
      await whitelist.write.removeAddress([alice.account.address], { account: owner.account });
      assert.equal(await whitelist.read.addressesCount(), 1n);
    });
  });
});
