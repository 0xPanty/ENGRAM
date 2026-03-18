"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { PromptGenerator } from "@/components/PromptGenerator";

export default function BackupPage() {
  const { isConnected } = useAccount();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Backup Your Soul</h1>
        <p className="text-zinc-400 mt-2">
          Connect your wallet, then copy the generated prompt into OpenClaw.
        </p>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-zinc-500">Connect your wallet to begin.</p>
          <ConnectButton />
        </div>
      ) : (
        <PromptGenerator />
      )}
    </div>
  );
}
