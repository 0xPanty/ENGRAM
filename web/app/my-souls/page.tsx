"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { SOULCLAW_ABI, SOULCLAW_ADDRESS } from "@/lib/contract";
import { SoulCard } from "@/components/SoulCard";

export default function MySoulsPage() {
  const { address, isConnected } = useAccount();

  const { data: balance } = useReadContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: totalSupply } = useReadContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "totalSupply",
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Souls</h1>
          <p className="text-zinc-400 mt-2">
            {isConnected && balance !== undefined
              ? `You own ${balance.toString()} soul(s)`
              : "Connect your wallet to view your souls."}
          </p>
        </div>
        {!isConnected && <ConnectButton />}
      </div>

      {isConnected && totalSupply !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: Number(totalSupply) }, (_, i) => (
            <SoulCardWrapper key={i} tokenId={BigInt(i)} ownerAddress={address!} />
          ))}
        </div>
      )}

      {isConnected && (balance === 0n || balance === undefined) && (
        <div className="text-center py-12">
          <p className="text-zinc-500 mb-4">You don&apos;t have any souls yet.</p>
          <a
            href="/backup"
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors inline-block"
          >
            Mint Your First Soul
          </a>
        </div>
      )}
    </div>
  );
}

function SoulCardWrapper({ tokenId, ownerAddress }: { tokenId: bigint; ownerAddress: string }) {
  const { data: owner } = useReadContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "ownerOf",
    args: [tokenId],
  });

  if (!owner || owner.toLowerCase() !== ownerAddress.toLowerCase()) return null;

  return <SoulCard tokenId={tokenId} />;
}
