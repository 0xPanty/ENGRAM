/**
 * 像素角色合成引擎
 *
 * 图层叠加顺序（从底到顶）：body -> bottom -> shoes -> top -> hair -> eyes -> accessory -> item
 * 素材放在 public/assets/{layer}/{index}.png，你做好素材后直接丢进去就能用。
 * 每张素材必须尺寸一致（推荐 64x64 或 128x128），背景透明 PNG。
 */

export interface TraitSelection {
  body: number;
  hair: number;
  eyes: number;
  top: number;
  bottom: number;
  shoes: number;
  accessory: number;
  item: number;
}

export const LAYER_ORDER: (keyof TraitSelection)[] = [
  "body",
  "bottom",
  "shoes",
  "top",
  "hair",
  "eyes",
  "accessory",
  "item",
];

export const LAYER_NAMES: Record<keyof TraitSelection, string[]> = {
  body: ["浅肤色-标准", "深肤色-标准", "浅肤色-高挑", "深肤色-高挑", "浅肤色-壮实"],
  hair: ["短发利落", "长发飘逸", "莫霍克", "卷发", "光头"],
  eyes: ["普通", "眼镜", "墨镜", "独眼", "发光"],
  top: ["正装衬衫", "连帽衫", "皮夹克", "实验室外套", "T恤"],
  bottom: ["西裤", "牛仔裤", "运动裤", "短裤"],
  shoes: ["皮鞋", "运动鞋", "靴子", "拖鞋"],
  accessory: ["耳机", "围巾", "棒球帽", "面具", "无"],
  item: ["笔记本电脑", "咖啡", "书", "工具箱", "无"],
};

export function getLayerPath(layer: keyof TraitSelection, index: number): string {
  return `/assets/${layer}/${index}.png`;
}

export function validateTraits(traits: TraitSelection): string | null {
  for (const layer of LAYER_ORDER) {
    const max = LAYER_NAMES[layer].length;
    const val = traits[layer];
    if (typeof val !== "number" || val < 1 || val > max) {
      return `Invalid ${layer}: must be 1-${max}, got ${val}`;
    }
  }
  return null;
}

export function getTraitDisplayNames(traits: TraitSelection): Record<string, string> {
  const result: Record<string, string> = {};
  for (const layer of LAYER_ORDER) {
    const names = LAYER_NAMES[layer];
    const idx = traits[layer] - 1;
    result[layer] = names[idx] ?? "Unknown";
  }
  return result;
}
