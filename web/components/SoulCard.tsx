"use client";

import { useReadContract } from "wagmi";
import { SOULCLAW_ABI, SOULCLAW_ADDRESS } from "@/lib/contract";

interface SoulCardProps {
  tokenId: bigint;
}

export function SoulCard({ tokenId }: SoulCardProps) {
  const { data: soulData, isLoading } = useReadContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "getSoulData",
    args: [tokenId],
  });

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-pulse">
        <div className="h-48 bg-zinc-800 rounded-lg mb-4" />
        <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
      </div>
    );
  }

  if (!soulData) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {soulData.imageUri && (
        <div className="aspect-square bg-zinc-800 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={soulData.imageUri}
            alt={`SoulClaw #${tokenId}`}
            className="w-full h-full object-contain image-rendering-pixelated"
          />
        </div>
      )}
      <div className="p-4 space-y-3">
        <h3 className="text-lg font-mono text-white">SoulClaw #{tokenId.toString()}</h3>
        <p className="text-violet-400 text-sm font-mono italic">
          {soulData.soulStatement}
        </p>
        <p className="text-zinc-400 text-sm">{soulData.soulSummary}</p>
        {soulData.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {soulData.skills.map((skill, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-violet-900/30 text-violet-300 text-xs rounded-md font-mono"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
        <div className="flex justify-between text-xs text-zinc-500 font-mono pt-2 border-t border-zinc-800">
          <span>v{soulData.version.toString()}</span>
          <span>{new Date(Number(soulData.lastUpdated) * 1000).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
