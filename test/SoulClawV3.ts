import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

const { viem, networkHelpers } = await network.connect();

const SAMPLE_DATA_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
const SAMPLE_STORE_TX = "0xabc123storeTxId";
const SAMPLE_IMAGE_URI = "https://arweave.net/img123";
const SAMPLE_SUMMARY = "A quiet code auditor.";
const SAMPLE_STATEMENT = "I search for truth.";
const SAMPLE_SKILLS: string[] = ["Solidity Auditor", "React Developer"];
const NEW_DATA_HASH = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;

function buildProof(dataHash: `0x${string}`, opts?: {
  sealedKey?: `0x${string}`;
  targetPubkey?: `0x${string}`;
  wantedKey?: `0x${string}`;
  accessNonce?: `0x${string}`;
  ownershipNonce?: `0x${string}`;
}) {
  return {
    accessProof: {
      dataHash,
      targetPubkey: opts?.wantedKey ?? ("0x" as `0x${string}`),
      nonce: opts?.accessNonce ?? ("0x01" as `0x${string}`),
      proof: "0x" as `0x${string}`,
    },
    ownershipProof: {
      oracleType: 0, // TEE
      dataHash,
      sealedKey: opts?.sealedKey ?? ("0xdeadbeef" as `0x${string}`),
      targetPubkey: opts?.targetPubkey ?? ("0x" as `0x${string}`),
      nonce: opts?.ownershipNonce ?? ("0x02" as `0x${string}`),
      proof: "0x" as `0x${string}`,
    },
  };
}

async function deployFixture() {
  const publicClient = await viem.getPublicClient();
  const [owner, user1, user2] = await viem.getWalletClients();

  const mockVerifier = await viem.deployContract("MockVerifier");
  const agentRegistry = await viem.deployContract("AgentRegistry");
  const soulClaw = await viem.deployContract("SoulClawV3", [mockVerifier.address, agentRegistry.address]);

  return { soulClaw, mockVerifier, agentRegistry, owner, user1, user2, publicClient };
}

async function mintedFixture() {
  const fixture = await deployFixture();
  const { soulClaw, user1 } = fixture;
  await soulClaw.write.mintSoul(
    [SAMPLE_DATA_HASH, SAMPLE_STORE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
    { value: parseEther("0.001"), account: user1.account }
  );
  return fixture;
}

describe("SoulClawV3", () => {
  describe("Deployment", () => {
    it("should set correct name, symbol, and verifier", async () => {
      const { soulClaw, mockVerifier } = await networkHelpers.loadFixture(deployFixture);
      assert.equal(await soulClaw.read.name(), "SoulClaw");
      assert.equal(await soulClaw.read.symbol(), "SOUL");
      assert.equal(await soulClaw.read.mintPrice(), parseEther("0.001"));
      const v = await soulClaw.read.verifier();
      assert.equal(getAddress(v), getAddress(mockVerifier.address));
    });
  });

  describe("Minting", () => {
    it("should mint and store soul data", async () => {
      const { soulClaw } = await networkHelpers.loadFixture(mintedFixture);
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.equal(soul.dataHash, SAMPLE_DATA_HASH);
      assert.equal(soul.storeTxId, SAMPLE_STORE_TX);
      assert.equal(soul.soulStatement, SAMPLE_STATEMENT);
      assert.equal(soul.version, 1n);
    });

    it("should reject duplicate mint", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(mintedFixture);
      await assert.rejects(
        soulClaw.write.mintSoul(
          [SAMPLE_DATA_HASH, SAMPLE_STORE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
          { value: parseEther("0.001"), account: user1.account }
        )
      );
    });

    it("should reject insufficient fee", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(
        soulClaw.write.mintSoul(
          [SAMPLE_DATA_HASH, SAMPLE_STORE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
          { value: parseEther("0.0001"), account: user1.account }
        )
      );
    });
  });

  describe("mintSoulFor (operator)", () => {
    it("should mint NFT owned by target address", async () => {
      const { soulClaw, owner, user1 } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.mintSoulFor(
        [user1.account.address, SAMPLE_DATA_HASH, SAMPLE_STORE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
        { value: parseEther("0.001"), account: owner.account }
      );
      const nftOwner = await soulClaw.read.ownerOf([0n]);
      assert.equal(getAddress(nftOwner), getAddress(user1.account.address));
    });
  });

  describe("Update Soul", () => {
    it("should update data and increment version", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(mintedFixture);
      await soulClaw.write.updateSoul(
        [0n, NEW_DATA_HASH, "0xnewtx", "", "", ""],
        { account: user1.account }
      );
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.equal(soul.dataHash, NEW_DATA_HASH);
      assert.equal(soul.version, 2n);
      assert.equal(soul.imageUri, SAMPLE_IMAGE_URI);
    });
  });

  describe("ERC-7857: intelligentDatasOf", () => {
    it("should return IntelligentData with dataHash and storeTxId", async () => {
      const { soulClaw } = await networkHelpers.loadFixture(mintedFixture);
      const datas = await soulClaw.read.intelligentDatasOf([0n]);
      assert.equal(datas.length, 1);
      assert.equal(datas[0].dataHash, SAMPLE_DATA_HASH);
      assert.equal(datas[0].dataDescription, SAMPLE_STORE_TX);
    });
  });

  describe("ERC-7857: iTransferFrom (mock verifier)", () => {
    it("should transfer NFT with proof, dataHash unchanged", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);

      const proof = buildProof(SAMPLE_DATA_HASH);

      await soulClaw.write.iTransferFrom(
        [user1.account.address, user2.account.address, 0n, [proof]],
        { account: user1.account }
      );

      const newOwner = await soulClaw.read.ownerOf([0n]);
      assert.equal(getAddress(newOwner), getAddress(user2.account.address));

      // dataHash stays the same (0G style: key re-delivery, not data re-encryption)
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.equal(soul.dataHash, SAMPLE_DATA_HASH);
      assert.equal(soul.version, 2n);
    });

    it("should reject transfer with wrong dataHash", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);

      const proof = buildProof(NEW_DATA_HASH); // wrong hash

      await assert.rejects(
        soulClaw.write.iTransferFrom(
          [user1.account.address, user2.account.address, 0n, [proof]],
          { account: user1.account }
        )
      );
    });

    it("should reject if not token owner", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);

      const proof = buildProof(SAMPLE_DATA_HASH);

      await assert.rejects(
        soulClaw.write.iTransferFrom(
          [user2.account.address, user1.account.address, 0n, [proof]],
          { account: user2.account }
        )
      );
    });

    it("should reject empty proof", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);

      await assert.rejects(
        soulClaw.write.iTransferFrom(
          [user1.account.address, user2.account.address, 0n, []],
          { account: user1.account }
        )
      );
    });
  });

  describe("ERC-7857: iClone (mock verifier)", () => {
    it("should clone NFT, both keep same dataHash", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);

      const proof = buildProof(SAMPLE_DATA_HASH, {
        accessNonce: "0x10" as `0x${string}`,
        ownershipNonce: "0x11" as `0x${string}`,
      });

      await soulClaw.write.iClone(
        [user2.account.address, 0n, [proof]],
        { account: user1.account }
      );

      const origOwner = await soulClaw.read.ownerOf([0n]);
      assert.equal(getAddress(origOwner), getAddress(user1.account.address));

      const cloneOwner = await soulClaw.read.ownerOf([1n]);
      assert.equal(getAddress(cloneOwner), getAddress(user2.account.address));

      // Both have same dataHash (same encrypted data, different key delivery)
      const origSoul = await soulClaw.read.getSoulData([0n]);
      const cloneSoul = await soulClaw.read.getSoulData([1n]);
      assert.equal(origSoul.dataHash, SAMPLE_DATA_HASH);
      assert.equal(cloneSoul.dataHash, SAMPLE_DATA_HASH);
      assert.equal(cloneSoul.soulStatement, SAMPLE_STATEMENT);

      assert.equal(await soulClaw.read.totalSupply(), 2n);
    });
  });

  describe("ERC-7857: Authorization", () => {
    it("should authorize and list users", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);

      await soulClaw.write.authorizeUsage([0n, user2.account.address], { account: user1.account });

      const users = await soulClaw.read.authorizedUsersOf([0n]);
      assert.equal(users.length, 1);
      assert.equal(getAddress(users[0]), getAddress(user2.account.address));
    });

    it("should revoke authorization", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(mintedFixture);

      await soulClaw.write.authorizeUsage([0n, user2.account.address], { account: user1.account });
      await soulClaw.write.revokeAuthorization([0n, user2.account.address], { account: user1.account });

      const users = await soulClaw.read.authorizedUsersOf([0n]);
      assert.equal(users.length, 0);
    });
  });

  describe("ERC-7857: delegateAccess", () => {
    it("should set and get delegate", async () => {
      const { soulClaw, user1, user2 } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.delegateAccess([user2.account.address], { account: user1.account });
      const delegate = await soulClaw.read.getDelegateAccess([user1.account.address]);
      assert.equal(getAddress(delegate), getAddress(user2.account.address));
    });
  });

  describe("ERC-7857: accessAssistant validation", () => {
    it("should reject transfer when accessAssistant mismatches receiver and delegate", async () => {
      const { soulClaw, user1, user2, owner } = await networkHelpers.loadFixture(mintedFixture);

      // user2 delegates to owner — _accessAssistants[user2] = owner (not address(0))
      await soulClaw.write.delegateAccess([owner.account.address], { account: user2.account });

      // MockVerifier returns accessAssistant=address(0), which is neither user2 nor owner
      const proof = buildProof(SAMPLE_DATA_HASH);

      await assert.rejects(
        soulClaw.write.iTransferFrom(
          [user1.account.address, user2.account.address, 0n, [proof]],
          { account: user1.account }
        )
      );
    });
  });

  describe("ERC-165: supportsInterface", () => {
    it("should support ERC-721 and ERC-2981", async () => {
      const { soulClaw } = await networkHelpers.loadFixture(deployFixture);
      assert.ok(await soulClaw.read.supportsInterface(["0x80ac58cd"])); // ERC-721
      assert.ok(await soulClaw.read.supportsInterface(["0x2a55205a"])); // ERC-2981
    });
  });

  describe("setVerifier", () => {
    it("should allow owner to update verifier", async () => {
      const { soulClaw, owner } = await networkHelpers.loadFixture(deployFixture);
      const newVerifier = await viem.deployContract("MockVerifier");
      await soulClaw.write.setVerifier([newVerifier.address], { account: owner.account });
      const v = await soulClaw.read.verifier();
      assert.equal(getAddress(v), getAddress(newVerifier.address));
    });

    it("should reject non-owner", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(
        soulClaw.write.setVerifier([user1.account.address], { account: user1.account })
      );
    });
  });

  describe("TokenURI", () => {
    it("should return valid base64 JSON", async () => {
      const { soulClaw } = await networkHelpers.loadFixture(mintedFixture);
      const uri = await soulClaw.read.tokenURI([0n]);
      assert.ok(uri.startsWith("data:application/json;base64,"));
    });
  });

  describe("updateSoulFor (operator)", () => {
    it("should allow owner to update on behalf of user", async () => {
      const { soulClaw, owner, user1 } = await networkHelpers.loadFixture(mintedFixture);
      await soulClaw.write.updateSoulFor(
        [user1.account.address, 0n, NEW_DATA_HASH, "0xnewtx", "", "", ""],
        { account: owner.account }
      );
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.equal(soul.dataHash, NEW_DATA_HASH);
      assert.equal(soul.version, 2n);
    });
  });

  describe("updateSkills", () => {
    it("should update skills array", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(mintedFixture);
      const newSkills = ["ZK Researcher", "Rust Developer"];
      await soulClaw.write.updateSkills([0n, newSkills], { account: user1.account });
      const soul = await soulClaw.read.getSoulData([0n]);
      assert.deepEqual([...soul.skills], newSkills);
    });
  });

  describe("Admin", () => {
    it("should allow owner to set mint price", async () => {
      const { soulClaw, owner } = await networkHelpers.loadFixture(deployFixture);
      await soulClaw.write.setMintPrice([parseEther("0.01")], { account: owner.account });
      assert.equal(await soulClaw.read.mintPrice(), parseEther("0.01"));
    });

    it("should allow owner to withdraw", async () => {
      const { soulClaw, owner, user1 } = await networkHelpers.loadFixture(mintedFixture);
      await soulClaw.write.withdraw({ account: owner.account });
    });
  });

  describe("ERC-8004: Auto-registration on mint", () => {
    it("should auto-register agent in AgentRegistry on mintSoul", async () => {
      const { soulClaw, agentRegistry, user1 } = await networkHelpers.loadFixture(mintedFixture);

      // Agent should be registered (agentId 0)
      const agentId = await soulClaw.read.getAgentId([0n]);
      assert.equal(agentId, 0n);

      // AgentRegistry should have minted NFT owned by user1
      const agentOwner = await agentRegistry.read.ownerOf([0n]);
      assert.equal(getAddress(agentOwner), getAddress(user1.account.address));

      // AgentRegistry should have totalSupply 1
      assert.equal(await agentRegistry.read.totalSupply(), 1n);
    });

    it("should auto-register agent in AgentRegistry on mintSoulFor", async () => {
      const { soulClaw, agentRegistry, owner, user1 } = await networkHelpers.loadFixture(deployFixture);

      await soulClaw.write.mintSoulFor(
        [user1.account.address, SAMPLE_DATA_HASH, SAMPLE_STORE_TX, SAMPLE_IMAGE_URI, SAMPLE_SUMMARY, SAMPLE_STATEMENT, SAMPLE_SKILLS],
        { value: parseEther("0.001"), account: owner.account }
      );

      const agentId = await soulClaw.read.getAgentId([0n]);
      assert.equal(agentId, 0n);

      const agentOwner = await agentRegistry.read.ownerOf([0n]);
      assert.equal(getAddress(agentOwner), getAddress(user1.account.address));
    });

    it("should store agentURI as base64 JSON with correct metadata", async () => {
      const { agentRegistry } = await networkHelpers.loadFixture(mintedFixture);

      const uri = await agentRegistry.read.tokenURI([0n]);
      assert.ok(uri.startsWith("data:application/json;base64,"));

      // Decode and verify
      const jsonStr = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString();
      const parsed = JSON.parse(jsonStr);
      assert.equal(parsed.name, "SoulClaw #0");
      assert.equal(parsed.description, SAMPLE_SUMMARY);
      assert.equal(parsed.active, true);
      assert.ok(parsed.supportedTrust.includes("reputation"));
      assert.ok(parsed.supportedTrust.includes("tee-attestation"));
    });

    it("should set agentWallet to owner on registration", async () => {
      const { agentRegistry, user1 } = await networkHelpers.loadFixture(mintedFixture);
      const wallet = await agentRegistry.read.getAgentWallet([0n]);
      assert.equal(getAddress(wallet), getAddress(user1.account.address));
    });

    it("should return correct agentId for owner", async () => {
      const { soulClaw, user1 } = await networkHelpers.loadFixture(mintedFixture);
      const agentId = await soulClaw.read.getAgentIdForOwner([user1.account.address]);
      assert.equal(agentId, 0n);
    });
  });

  describe("ERC-8004: AgentRegistry standalone", () => {
    it("should allow direct registration", async () => {
      const { agentRegistry, user2 } = await networkHelpers.loadFixture(deployFixture);
      await agentRegistry.write.register(["https://example.com/agent.json"], { account: user2.account });
      const uri = await agentRegistry.read.tokenURI([0n]);
      assert.equal(uri, "https://example.com/agent.json");
    });

    it("should allow setting metadata", async () => {
      const { agentRegistry, user2 } = await networkHelpers.loadFixture(deployFixture);
      await agentRegistry.write.register(["https://example.com/agent.json"], { account: user2.account });
      await agentRegistry.write.setMetadata([0n, "skills", "0x1234" as `0x${string}`], { account: user2.account });
      const meta = await agentRegistry.read.getMetadata([0n, "skills"]);
      assert.equal(meta, "0x1234");
    });

    it("should reject setting reserved key 'agentWallet'", async () => {
      const { agentRegistry, user2 } = await networkHelpers.loadFixture(deployFixture);
      await agentRegistry.write.register([""], { account: user2.account });
      await assert.rejects(
        agentRegistry.write.setMetadata([0n, "agentWallet", "0x1234" as `0x${string}`], { account: user2.account })
      );
    });

    it("should update agentURI", async () => {
      const { agentRegistry, user2 } = await networkHelpers.loadFixture(deployFixture);
      await agentRegistry.write.register(["old-uri"], { account: user2.account });
      await agentRegistry.write.setAgentURI([0n, "new-uri"], { account: user2.account });
      assert.equal(await agentRegistry.read.tokenURI([0n]), "new-uri");
    });
  });

  describe("ERC-8004: ReputationRegistry", () => {
    it("should accept feedback for a registered agent", async () => {
      const { agentRegistry, user1, user2 } = await networkHelpers.loadFixture(deployFixture);

      // user1 registers an agent
      await agentRegistry.write.register(["uri"], { account: user1.account });

      // Deploy reputation registry
      const reputation = await viem.deployContract("ReputationRegistry", [agentRegistry.address]);

      // user2 gives feedback (rating 85/100)
      await reputation.write.giveFeedback([0n, 85n, 0, "starred", "", "", "", "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`], { account: user2.account });

      const fb = await reputation.read.readFeedback([0n, user2.account.address, 1n]);
      assert.equal(fb[0], 85n); // value
      assert.equal(fb[4], false); // not revoked
    });

    it("should reject self-feedback", async () => {
      const { agentRegistry, user1 } = await networkHelpers.loadFixture(deployFixture);
      await agentRegistry.write.register(["uri"], { account: user1.account });
      const reputation = await viem.deployContract("ReputationRegistry", [agentRegistry.address]);

      await assert.rejects(
        reputation.write.giveFeedback([0n, 100n, 0, "", "", "", "", "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`], { account: user1.account })
      );
    });

    it("should allow revoking feedback", async () => {
      const { agentRegistry, user1, user2 } = await networkHelpers.loadFixture(deployFixture);
      await agentRegistry.write.register(["uri"], { account: user1.account });
      const reputation = await viem.deployContract("ReputationRegistry", [agentRegistry.address]);

      await reputation.write.giveFeedback([0n, 90n, 0, "", "", "", "", "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`], { account: user2.account });
      await reputation.write.revokeFeedback([0n, 1n], { account: user2.account });

      const fb = await reputation.read.readFeedback([0n, user2.account.address, 1n]);
      assert.equal(fb[4], true); // revoked
    });

    it("should track client list", async () => {
      const { agentRegistry, user1, user2, owner } = await networkHelpers.loadFixture(deployFixture);
      await agentRegistry.write.register(["uri"], { account: user1.account });
      const reputation = await viem.deployContract("ReputationRegistry", [agentRegistry.address]);

      await reputation.write.giveFeedback([0n, 80n, 0, "", "", "", "", "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`], { account: user2.account });
      await reputation.write.giveFeedback([0n, 95n, 0, "", "", "", "", "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`], { account: owner.account });

      const clients = await reputation.read.getClients([0n]);
      assert.equal(clients.length, 2);
    });
  });
});
