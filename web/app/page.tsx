"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
      <h1 className="text-5xl font-bold tracking-tight">
        Your AI Soul,
        <br />
        <span className="text-violet-400">On-Chain Forever.</span>
      </h1>
      <p className="text-zinc-400 max-w-lg text-lg">
        Back up your OpenClaw memory, personality, and skills to Arweave.
        Mint a pixel soul NFT on Base. Restore anywhere, anytime.
      </p>
      <ConnectButton />
      {isConnected && (
        <div className="flex gap-4 pt-4">
          <a
            href="/backup"
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
          >
            Begin the Ritual
          </a>
          <a
            href="/my-souls"
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            My Souls
          </a>
        </div>
      )}
    </div>
  );
}
