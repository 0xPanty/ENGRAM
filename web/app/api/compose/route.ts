import { NextRequest, NextResponse } from "next/server";
import {
  type TraitSelection,
  LAYER_ORDER,
  validateTraits,
  getLayerPath,
  getTraitDisplayNames,
} from "@/lib/pixel-composer";

/**
 * POST /api/compose
 * 接收 trait JSON，返回图层路径列表 + 属性名。
 * 实际合成在浏览器端用 Canvas 完成（兼容 Vercel 部署）。
 *
 * 如果 Agent 调用此 API，可以直接拿 layers 列表自行合成或下载。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const traits = body.traits as TraitSelection;

    if (!traits) {
      return NextResponse.json({ error: "Missing traits object" }, { status: 400 });
    }

    const validationError = validateTraits(traits);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const layers: { layer: string; index: number; path: string }[] = [];
    for (const layer of LAYER_ORDER) {
      const index = traits[layer];
      if ((layer === "accessory" || layer === "item") && index === 5) continue;
      layers.push({ layer, index, path: getLayerPath(layer, index) });
    }

    const displayNames = getTraitDisplayNames(traits);

    return NextResponse.json({
      traits,
      layers,
      displayNames,
      spriteSize: 128,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
