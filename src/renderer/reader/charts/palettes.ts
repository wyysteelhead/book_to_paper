import type { CSSProperties } from "react";
import type { PaperFigure } from "../../../common/types";
import { chartConfigs } from "../../paper/chartConfigs";

type PaletteStyle = CSSProperties & {
  "--chart-c1": string;
  "--chart-c2": string;
  "--chart-c3": string;
  "--chart-c4": string;
};

const twoColorPalettes = [
  ["#2f66b3", "#c73e3a"],
  ["#202020", "#f4f0e8"],
  ["#2d6f8f", "#d98b2b"],
  ["#5a6f8f", "#9b2f4d"],
  ["#3f7f5f", "#7b4ab0"]
];

const multiColorPalettes = [
  ["#2f66b3", "#c73e3a", "#3b8f4f", "#d98b2b"],
  ["#1f2933", "#f0efe8", "#8c6f3f", "#6f8a9b"],
  ["#315f8c", "#d07c2c", "#5a8a72", "#8c3d5b"],
  ["#2d6f8f", "#b59a3b", "#6b4fa3", "#c76532"],
  ["#3f5d5a", "#8c4a3f", "#5f6f95", "#8c7f45"]
];

const sequentialPalettes = [
  ["#315f8c", "#b89b32"],
  ["#3f6f5d", "#9b2f4d"],
  ["#2d6f8f", "#d98b2b"],
  ["#5f6f95", "#8c4a3f"]
];

const categoricalPalettes = [
  ["#2f66b3", "#c73e3a", "#3b8f4f", "#d98b2b"],
  ["#1f2933", "#8c6f3f", "#6f8a9b", "#b59a3b"],
  ["#315f8c", "#d07c2c", "#5a8a72", "#8c3d5b"]
];

export function pickPalette(seed: string, count: number): string[] {
  const palettes = count <= 2 ? twoColorPalettes : multiColorPalettes;
  const index = hashString(seed) % palettes.length;
  return palettes[index];
}

export function pickFigurePalette(figure: PaperFigure): string[] {
  const config = chartConfigs[figure.chartType];
  if (config.paletteMode === "sequential") {
    return sequentialPalettes[hashString(figure.id) % sequentialPalettes.length];
  }
  if (config.paletteMode === "categorical") {
    return categoricalPalettes[hashString(figure.id) % categoricalPalettes.length];
  }
  return pickPalette(figure.id, colorCountForFigure(figure));
}

export function colorCountForFigure(figure: PaperFigure): number {
  if (figure.data?.kind === "ranked") return Math.min(5, figure.data.labels.length);
  if (figure.data?.kind === "series") return figure.chartType === "line" ? 2 : Math.min(4, figure.data.values.length);
  return figure.chartType === "flow" ? 4 : 3;
}

export function paletteStyle(palette: string[]): PaletteStyle {
  return {
    "--chart-c1": palette[0],
    "--chart-c2": palette[1] ?? palette[0],
    "--chart-c3": palette[2] ?? palette[0],
    "--chart-c4": palette[3] ?? palette[1] ?? palette[0]
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
