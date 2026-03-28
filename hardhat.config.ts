import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  etherscan: {
    apiKey: {
      baseSepolia: configVariable("BASESCAN_API_KEY"),
      base: configVariable("BASESCAN_API_KEY"),
    },
  },
  paths: {
    tests: {
      nodejs: "./test",
    },
  },
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhatLocal: {
      type: "edr-simulated",
      chainType: "l1",
    },
    baseSepolia: {
      type: "http",
      chainType: "op",
      url: configVariable("BASE_SEPOLIA_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
      chainId: 84532,
    },
    baseMainnet: {
      type: "http",
      chainType: "op",
      url: configVariable("BASE_MAINNET_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
      chainId: 8453,
    },
  },
});
