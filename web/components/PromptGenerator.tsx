"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { generateBackupPrompt, generateRestorePrompt, generateReencryptPrompt } from "@/lib/prompts";
import { SOULCLAW_ADDRESS } from "@/lib/contract";

type PromptType = "backup" | "restore" | "reencrypt";

export function PromptGenerator() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [promptType, setPromptType] = useState<PromptType>("backup");
  const [tokenId, setTokenId] = useState("");
  const [copied, setCopied] = useState(false);
  const composeApiUrl = process.env.NEXT_PUBLIC_COMPOSE_API_URL ?? "https://soulclaw.xyz";

  if (!address) return null;

  let prompt = "";
  if (promptType === "backup") {
    prompt = generateBackupPrompt({
      walletAddress: address,
      contractAddress: SOULCLAW_ADDRESS,
      chainId,
      composeApiUrl,
    });
  } else if (promptType === "restore" && tokenId) {
    prompt = generateRestorePrompt({
      contractAddress: SOULCLAW_ADDRESS,
      chainId,
      tokenId,
    });
  } else if (promptType === "reencrypt" && tokenId) {
    prompt = generateReencryptPrompt({
      contractAddress: SOULCLAW_ADDRESS,
      chainId,
      tokenId,
    });
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {(["backup", "restore", "reencrypt"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setPromptType(type)}
            className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
              promptType === type
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {type === "backup" ? "BACKUP" : type === "restore" ? "RESTORE" : "RE-ENCRYPT"}
          </button>
        ))}
      </div>

      {(promptType === "restore" || promptType === "reencrypt") && (
        <input
          type="text"
          placeholder="Token ID"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono focus:outline-none focus:border-violet-500"
        />
      )}

      {prompt && (
        <>
          <div className="relative">
            <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 font-mono overflow-auto max-h-96 whitespace-pre-wrap">
              {prompt}
            </pre>
          </div>
          <button
            onClick={handleCopy}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-mono rounded-lg transition-colors"
          >
            {copied ? "COPIED" : "COPY PROMPT"}
          </button>
        </>
      )}
    </div>
  );
}
