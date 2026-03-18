"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { type Address, parseEther } from "viem";
import { SOULCLAW_ABI, SOULCLAW_ADDRESS } from "./contract";

export function useSoulData(tokenId: bigint | undefined) {
  return useReadContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "getSoulData",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useHasMinted(address: Address | undefined) {
  return useReadContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "hasMinted",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useMintPrice() {
  return useReadContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "mintPrice",
  });
}

export function useTotalSupply() {
  return useReadContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "totalSupply",
  });
}

export function useBalanceOf(address: Address | undefined) {
  return useReadContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useMintSoul() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (params: {
    dataHash: `0x${string}`;
    arweaveTxId: string;
    imageUri: string;
    soulSummary: string;
    soulStatement: string;
    skills: string[];
    mintPrice?: bigint;
  }) => {
    writeContract({
      address: SOULCLAW_ADDRESS,
      abi: SOULCLAW_ABI,
      functionName: "mintSoul",
      args: [
        params.dataHash,
        params.arweaveTxId,
        params.imageUri,
        params.soulSummary,
        params.soulStatement,
        params.skills,
      ],
      value: params.mintPrice ?? parseEther("0.001"),
    });
  };

  return { mint, hash, isPending, isConfirming, isSuccess, error };
}

export function useUpdateSoul() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const update = (params: {
    tokenId: bigint;
    newDataHash: `0x${string}`;
    newArweaveTxId: string;
    newImageUri?: string;
    newSoulSummary?: string;
    newSoulStatement?: string;
  }) => {
    writeContract({
      address: SOULCLAW_ADDRESS,
      abi: SOULCLAW_ABI,
      functionName: "updateSoul",
      args: [
        params.tokenId,
        params.newDataHash,
        params.newArweaveTxId,
        params.newImageUri ?? "",
        params.newSoulSummary ?? "",
        params.newSoulStatement ?? "",
      ],
    });
  };

  return { update, hash, isPending, isConfirming, isSuccess, error };
}

export function useUpdateSkills() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const updateSkills = (tokenId: bigint, skills: string[]) => {
    writeContract({
      address: SOULCLAW_ADDRESS,
      abi: SOULCLAW_ABI,
      functionName: "updateSkills",
      args: [tokenId, skills],
    });
  };

  return { updateSkills, hash, isPending, isConfirming, isSuccess, error };
}
