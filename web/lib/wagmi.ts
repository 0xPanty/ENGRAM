import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia, base } from "wagmi/chains";

const chains =
  process.env.NEXT_PUBLIC_ENABLE_MAINNET === "true"
    ? ([base, baseSepolia] as const)
    : ([baseSepolia] as const);

export const config = getDefaultConfig({
  appName: "SoulClaw",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID",
  chains,
  ssr: true,
});
