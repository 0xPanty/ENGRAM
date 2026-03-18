"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { type TraitSelection, LAYER_ORDER } from "@/lib/pixel-composer";

interface PixelComposerProps {
  traits: TraitSelection;
  size?: number;
  onComposed?: (dataUrl: string) => void;
}

const SPRITE_SIZE = 128;

export function PixelComposer({ traits, size = 256, onComposed }: PixelComposerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  const compose = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    ctx.imageSmoothingEnabled = false;
    setError(null);

    let loadedAny = false;
    for (const layer of LAYER_ORDER) {
      const index = traits[layer];
      if ((layer === "accessory" || layer === "item") && index === 5) continue;

      const src = `/assets/${layer}/${index}.png`;
      try {
        const img = await loadImageAsync(src);
        ctx.drawImage(img, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
        loadedAny = true;
      } catch {
        // 素材还没做，跳过
      }
    }

    if (!loadedAny) {
      // 没有素材时画一个占位方块
      ctx.fillStyle = "#7c3aed";
      ctx.fillRect(20, 20, SPRITE_SIZE - 40, SPRITE_SIZE - 40);
      ctx.fillStyle = "#fff";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SOUL", SPRITE_SIZE / 2, SPRITE_SIZE / 2 + 4);
    }

    onComposed?.(canvas.toDataURL("image/png"));
  }, [traits, onComposed]);

  useEffect(() => {
    compose();
  }, [compose]);

  return (
    <div className="inline-block">
      <canvas
        ref={canvasRef}
        width={SPRITE_SIZE}
        height={SPRITE_SIZE}
        style={{
          width: size,
          height: size,
          imageRendering: "pixelated",
        }}
        className="border border-zinc-700 rounded-lg bg-zinc-900"
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function loadImageAsync(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
