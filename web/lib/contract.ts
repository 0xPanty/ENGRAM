import { type Address } from "viem";

export const SOULCLAW_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Address) ??
  "0x0000000000000000000000000000000000000000";

export const SOULCLAW_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "bytes32", name: "dataHash", type: "bytes32" },
    ],
    name: "SoulMinted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" },
      { indexed: false, internalType: "bytes32", name: "oldHash", type: "bytes32" },
      { indexed: false, internalType: "bytes32", name: "newHash", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "version", type: "uint256" },
    ],
    name: "SoulUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" },
      { indexed: false, internalType: "string[]", name: "skills", type: "string[]" },
    ],
    name: "SkillsUpdated",
    type: "event",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "dataHash", type: "bytes32" },
      { internalType: "string", name: "arweaveTxId", type: "string" },
      { internalType: "string", name: "imageUri", type: "string" },
      { internalType: "string", name: "soulSummary", type: "string" },
      { internalType: "string", name: "soulStatement", type: "string" },
      { internalType: "string[]", name: "skills", type: "string[]" },
    ],
    name: "mintSoul",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "tokenId", type: "uint256" },
      { internalType: "bytes32", name: "newDataHash", type: "bytes32" },
      { internalType: "string", name: "newArweaveTxId", type: "string" },
      { internalType: "string", name: "newImageUri", type: "string" },
      { internalType: "string", name: "newSoulSummary", type: "string" },
      { internalType: "string", name: "newSoulStatement", type: "string" },
    ],
    name: "updateSoul",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "tokenId", type: "uint256" },
      { internalType: "string[]", name: "newSkills", type: "string[]" },
    ],
    name: "updateSkills",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "getSoulData",
    outputs: [
      {
        components: [
          { internalType: "bytes32", name: "dataHash", type: "bytes32" },
          { internalType: "string", name: "arweaveTxId", type: "string" },
          { internalType: "string", name: "imageUri", type: "string" },
          { internalType: "string", name: "soulSummary", type: "string" },
          { internalType: "string", name: "soulStatement", type: "string" },
          { internalType: "string[]", name: "skills", type: "string[]" },
          { internalType: "uint256", name: "version", type: "uint256" },
          { internalType: "uint256", name: "lastUpdated", type: "uint256" },
        ],
        internalType: "struct SoulClaw.SoulData",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "hasMinted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "mintPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "bytes32", name: "dataHash", type: "bytes32" },
      { internalType: "string", name: "arweaveTxId", type: "string" },
      { internalType: "string", name: "imageUri", type: "string" },
      { internalType: "string", name: "soulSummary", type: "string" },
      { internalType: "string", name: "soulStatement", type: "string" },
      { internalType: "string[]", name: "skills", type: "string[]" },
    ],
    name: "mintSoulFor",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "soulOwner", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
      { internalType: "bytes32", name: "newDataHash", type: "bytes32" },
      { internalType: "string", name: "newArweaveTxId", type: "string" },
      { internalType: "string", name: "newImageUri", type: "string" },
      { internalType: "string", name: "newSoulSummary", type: "string" },
      { internalType: "string", name: "newSoulStatement", type: "string" },
    ],
    name: "updateSoulFor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
