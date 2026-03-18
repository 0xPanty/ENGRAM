"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { generateRestorePrompt } from "@/lib/prompts";
import { SOULCLAW_ADDRESS } from "@/lib/contract";

export default function RestorePage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [tokenId, setTokenId] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = tokenId
    ? generateRestorePrompt({ contractAddress: SOULCLAW_ADDRESS, chainId, tokenId })
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Restore Your Soul</h1>
        <p className="text-zinc-400 mt-2">
          Enter your Soul NFT Token ID and copy the restore prompt into OpenClaw.
        </p>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-zinc-500">Connect your wallet to begin.</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-6">
          <input
            type="text"
            placeholder="Token ID (e.g. 0)"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono focus:outline-none focus:border-violet-500"
          />
          {prompt && (
            <>
              <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 font-mono overflow-auto max-h-96 whitespace-pre-wrap">
                {prompt}
              </pre>
              <button
                onClick={handleCopy}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-mono rounded-lg transition-colors"
              >
                {copied ? "COPIED" : "COPY RESTORE PROMPT"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
