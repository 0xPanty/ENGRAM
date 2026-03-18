import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseEther } from "viem";

const { viem, networkHelpers } = await network.connect();

const SAMPLE_DATA_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
const SAMPLE_ARWEAVE_TX = "abc123txid";
const SAMPLE_IMAGE_URI = "https://arweave.net/img123";
const SAMPLE_SUMMARY = "A quiet code auditor who finds truth in terminals.";
const SAMPLE_STATEMENT = "I search for truth in the dark of the terminal.";
const SAMPLE_SKILLS: string[] = ["Solidity Auditor", "React Developer"];
const NEW_DATA_HASH = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;

async function deployFixture() {
  const publicClient = await viem.getPublicClient();
  const [owner, user1, user2] = await viem.getWalletClients();
  const soulClaw = await viem.deployContract("SoulClaw");
  return { soulClaw, owner, user1, user2, publicClient };
}

async function mintedFixture() {
  const { soulClaw, owner, user1, user2, publicClient } = await deployFixture();
  await soulClaw.write.mintSoul(
    [SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
    { value: parseEther("0.001"), account: user1.account }
  );
  return { soulClaw, owner, user1, user2, publicClient };
}

describe("SoulClaw", () => {
  describe("Deployment", () => {
    it("should set correct name, symbol, and mint price", async () => {
      const { soulClaw, owner } = await networkHelpers.loadFixture(deployFixture);
      assert.equal(await soulClaw.read.name(), "SoulClaw");
      assert.equal(await soulClaw.read.symbol(), "SOUL");
      assert.equal(await soulClaw.read.mintPrice(), parseEther("0.001"));
      const contractOwner = await soulClaw.read.owner();
      assert.equal(contractOwner.toLowerCase(), owner.account.address.toLowerCase());
    });
  });

  describe("Minting", () => {
    it("should mint a soul NFT with correct data", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(mintedFixture);
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.equal(soul.dataHash, SAMPLE_DATA_HASH);
      assert.equal(soul.arweaveTxId, SAMPLE_ARWEAVE_TX);
      assert.equal(soul.imageUri, SAMPLE_IMAGE_URI);
      assert.equal(soul.soulSummary, SAMPLE_SUMMARY);
      assert.equal(soul.soulStatement, SAMPLE_STATEMENT);
      assert.deepEqual([...soul.skills], SAMPLE_SKILLS);
      assert.equal(soul.version, 1n);
      assert.equal(await soulClaw.read.totalSupply(), 1n);
      assert.equal(await soulClaw.read.hasMinted([user1.account.address]), true);
    });

    it("should reject duplicate mint from same wallet", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(mintedFixture);
      await assert.rejects(
        soulClaw.write.mintSoul(
          [SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
          { value: parseEther("0.001"), account: user1.account }
        )
      );
    });

    it("should reject mint with insufficient fee", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(
        soulClaw.write.mintSoul(
          [SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
          { value: parseEther("0.0001"), account: user1.account }
        )
      );
    });
  });

  describe("Update Soul", () => {
    it("should update dataHash and arweaveTxId, keep unchanged fields", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(mintedFixture);
      await soulClaw.write.updateSoul(
        [0n, NEW_DATA_HASH, "newTx456", "", "", ""],
        { account: user1.account }
      );
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.equal(soul.dataHash, NEW_DATA_HASH);
      assert.equal(soul.arweaveTxId, "newTx456");
      assert.equal(soul.imageUri, SAMPLE_IMAGE_URI);
      assert.equal(soul.soulSummary, SAMPLE_SUMMARY);
      assert.equal(soul.version, 2n);
    });

    it("should update public profile fields when non-empty", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(mintedFixture);
      await soulClaw.write.updateSoul(
        [0n, SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, "https://arweave.net/newimg", "New summary", "I evolved."],
        { account: user1.account }
      );
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.equal(soul.imageUri, "https://arweave.net/newimg");
      assert.equal(soul.soulSummary, "New summary");
      assert.equal(soul.soulStatement, "I evolved.");
    });

    it("should reject update from non-owner", async () => {
      const { soulClaw, user2 } = await networkHelpers.loadFixture(mintedFixture);
      await assert.rejects(
        soulClaw.write.updateSoul(
          [0n, SAMPLE_DATA_HASH, "newtx", "", "", ""],
          { account: user2.account }
        )
      );
    });
  });

  describe("Update Skills", () => {
    it("should update skill list", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(mintedFixture);
      const newSkills = ["Python ML", "Data Pipeline", "API Design"];
      await soulClaw.write.updateSkills([0n, newSkills], { account: user1.account });
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.deepEqual([...soul.skills], newSkills);
    });

    it("should reject skill update from non-owner", async () => {
      const { soulClaw, user2 } = await networkHelpers.loadFixture(mintedFixture);
      await assert.rejects(
        soulClaw.write.updateSkills([0n, ["Hack"]], { account: user2.account })
      );
    });
  });

  describe("TokenURI", () => {
    it("should return valid base64 JSON with skills", async () => {
      const { soulClaw } = await networkHelpers.loadFixture(mintedFixture);
      const uri = await soulClaw.read.tokenURI([0n]);
      assert.ok(uri.startsWith("data:application/json;base64,"));
      const jsonStr = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf-8");
      const metadata = JSON.parse(jsonStr);
      assert.equal(metadata.name, "SoulClaw #0");
      assert.equal(metadata.image, SAMPLE_IMAGE_URI);
      assert.equal(metadata.description, SAMPLE_STATEMENT);
      assert.ok(metadata.attributes.length >= 3); // 2 skills + version
      const skillAttrs = metadata.attributes.filter((a: any) => a.trait_type === "Skill");
      assert.equal(skillAttrs.length, 2);
      assert.equal(skillAttrs[0].value, "Solidity Auditor");
      assert.equal(skillAttrs[1].value, "React Developer");
    });

    it("should return valid JSON when skills are empty", async () => {
      const { soulClaw, user2 } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.mintSoul(
        [SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, []],
        { value: parseEther("0.001"), account: user2.account }
      );
      const uri = await soulClaw.read.tokenURI([0n]);
      const jsonStr = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf-8");
      const metadata = JSON.parse(jsonStr);
      assert.equal(metadata.attributes.length, 1);
      assert.equal(metadata.attributes[0].trait_type, "Version");
      assert.equal(metadata.attributes[0].value, 1);
    });

    it("should revert for non-existent token", async () => {
      const { soulClaw } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(soulClaw.read.tokenURI([999n]));
    });
  });

  describe("Transfer", () => {
    it("should allow standard ERC-721 transfer", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);
      await soulClaw.write.transferFrom(
        [user1.account.address, user2.account.address, 0n],
        { account: user1.account }
      );
      const newOwner = await soulClaw.read.ownerOf([0n]);
      assert.equal(newOwner.toLowerCase(), user2.account.address.toLowerCase());
    });

    it("should allow new owner to update soul after transfer", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);
      await soulClaw.write.transferFrom(
        [user1.account.address, user2.account.address, 0n],
        { account: user1.account }
      );
      await soulClaw.write.updateSoul(
        [0n, NEW_DATA_HASH, "newtx", "", "", ""],
        { account: user2.account }
      );
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.equal(soul.dataHash, NEW_DATA_HASH);
    });

    it("buyer can still mint their own soul after receiving transfer", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);
      await soulClaw.write.transferFrom(
        [user1.account.address, user2.account.address, 0n],
        { account: user1.account }
      );
      await soulClaw.write.mintSoul(
        [SAMPLE_DATA_HASH, "user2tx", SAMPLE_IMAGE_URI, "User2", "Statement", ["Skill A"]],
        { value: parseEther("0.001"), account: user2.account }
      );
      assert.equal(await soulClaw.read.totalSupply(), 2n);
    });
  });

  describe("Royalty (ERC-2981)", () => {
    it("should return 5% royalty to deployer", async () => {
      const { soulClaw, owner } = await networkHelpers.loadFixture(mintedFixture);
      const [receiver, amount] = await soulClaw.read.royaltyInfo([0n, parseEther("1")]);
      assert.equal(receiver.toLowerCase(), owner.account.address.toLowerCase());
      assert.equal(amount, parseEther("0.05"));
    });
  });

  describe("Owner Functions", () => {
    it("should allow owner to set mint price", async () => {
      const { soulClaw, owner } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.setMintPrice([parseEther("0.01")], { account: owner.account });
      assert.equal(await soulClaw.read.mintPrice(), parseEther("0.01"));
    });

    it("should reject non-owner setting mint price", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(
        soulClaw.write.setMintPrice([parseEther("0.01")], { account: user1.account })
      );
    });

    it("should allow owner to withdraw mint fees", async () => {
      const { soulClaw, owner, publicClient } = await networkHelpers.loadFixture(mintedFixture);
      const balanceBefore = await publicClient.getBalance({ address: owner.account.address });
      await soulClaw.write.withdraw({ account: owner.account });
      const balanceAfter = await publicClient.getBalance({ address: owner.account.address });
      assert.ok(balanceAfter > balanceBefore - parseEther("0.0001"));
    });
  });

  describe("mintSoulFor (operator mints for user)", () => {
    it("should mint NFT owned by target address, not deployer", async () => {
      const { soulClaw, owner, user1 } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.mintSoulFor(
        [user1.account.address, SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
        { value: parseEther("0.001"), account: owner.account }
      );
      const nftOwner = await soulClaw.read.ownerOf([0n]);
      assert.equal(nftOwner.toLowerCase(), user1.account.address.toLowerCase());
      assert.equal(await soulClaw.read.hasMinted([user1.account.address]), true);
      assert.equal(await soulClaw.read.hasMinted([owner.account.address]), false);
    });

    it("should reject mintSoulFor from non-owner", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(
        soulClaw.write.mintSoulFor(
          [user2.account.address, SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
          { value: parseEther("0.001"), account: user1.account }
        )
      );
    });

    it("should reject duplicate mintSoulFor for same target", async () => {
      const { soulClaw, owner, user1 } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.mintSoulFor(
        [user1.account.address, SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
        { value: parseEther("0.001"), account: owner.account }
      );
      await assert.rejects(
        soulClaw.write.mintSoulFor(
          [user1.account.address, NEW_DATA_HASH, "tx2", SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, []],
          { value: parseEther("0.001"), account: owner.account }
        )
      );
    });
  });

  describe("updateSoulFor (operator updates for user)", () => {
    it("should update soul data when operator specifies correct owner", async () => {
      const { soulClaw, owner, user1 } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.mintSoulFor(
        [user1.account.address, SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
        { value: parseEther("0.001"), account: owner.account }
      );
      await soulClaw.write.updateSoulFor(
        [user1.account.address, 0n, NEW_DATA_HASH, "newTx", "", "", ""],
        { account: owner.account }
      );
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.equal(soul.dataHash, NEW_DATA_HASH);
      assert.equal(soul.arweaveTxId, "newTx");
      assert.equal(soul.version, 2n);
    });

    it("should reject updateSoulFor with wrong owner address", async () => {
      const { soulClaw, owner, user1, user2 } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.mintSoulFor(
        [user1.account.address, SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
        { value: parseEther("0.001"), account: owner.account }
      );
      await assert.rejects(
        soulClaw.write.updateSoulFor(
          [user2.account.address, 0n, NEW_DATA_HASH, "newTx", "", "", ""],
          { account: owner.account }
        )
      );
    });

    it("should reject updateSoulFor from non-owner (non-operator)", async () => {
      const { soulClaw, owner, user1 } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.mintSoulFor(
        [user1.account.address, SAMPLE_DATA_HASH, SAMPLE_ARWEAVE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
        { value: parseEther("0.001"), account: owner.account }
      );
      await assert.rejects(
        soulClaw.write.updateSoulFor(
          [user1.account.address, 0n, NEW_DATA_HASH, "newTx", "", "", ""],
          { account: user1.account }
        )
      );
    });
  });

  describe("supportsInterface", () => {
    it("should support ERC-721 and ERC-2981", async () => {
      const { soulClaw } = await networkHelpers.loadFixture(deployFixture);
      assert.ok(await soulClaw.read.supportsInterface(["0x80ac58cd"])); // ERC-721
      assert.ok(await soulClaw.read.supportsInterface(["0x2a55205a"])); // ERC-2981
    });
  });
});
