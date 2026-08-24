import type { FigureLayoutType, PaperFigure } from "../../common/types";

type ChartPlacement = "single_only" | "span_allowed" | "span_preferred";
type PaletteMode = "sequential" | "categorical" | "mixed";

export type ChartConfig = {
  placement: ChartPlacement;
  paletteMode: PaletteMode;
  minSpanPoints: number;
  inlineHeight: "compact" | "medium" | "large";
};

export const chartConfigs: Record<PaperFigure["chartType"], ChartConfig> = {
  bar: {
    placement: "span_allowed",
    paletteMode: "mixed",
    minSpanPoints: 9,
    inlineHeight: "medium"
  },
  grouped_bar: {
    placement: "span_allowed",
    paletteMode: "categorical",
    minSpanPoints: 12,
    inlineHeight: "medium"
  },
  stacked_bar: {
    placement: "span_allowed",
    paletteMode: "categorical",
    minSpanPoints: 12,
    inlineHeight: "medium"
  },
  line: {
    placement: "span_allowed",
    paletteMode: "sequential",
    minSpanPoints: 8,
    inlineHeight: "compact"
  },
  area: {
    placement: "span_allowed",
    paletteMode: "sequential",
    minSpanPoints: 8,
    inlineHeight: "compact"
  },
  pie: {
    placement: "single_only",
    paletteMode: "categorical",
    minSpanPoints: 99,
    inlineHeight: "compact"
  },
  scatter: {
    placement: "span_allowed",
    paletteMode: "categorical",
    minSpanPoints: 16,
    inlineHeight: "medium"
  },
  matrix: {
    placement: "span_allowed",
    paletteMode: "sequential",
    minSpanPoints: 16,
    inlineHeight: "medium"
  },
  gantt: {
    placement: "span_allowed",
    paletteMode: "categorical",
    minSpanPoints: 8,
    inlineHeight: "medium"
  },
  candlestick: {
    placement: "single_only",
    paletteMode: "sequential",
    minSpanPoints: 99,
    inlineHeight: "compact"
  },
  radar: {
    placement: "single_only",
    paletteMode: "categorical",
    minSpanPoints: 99,
    inlineHeight: "compact"
  },
  word_cloud: {
    placement: "single_only",
    paletteMode: "categorical",
    minSpanPoints: 16,
    inlineHeight: "compact"
  },
  heatmap: {
    placement: "span_allowed",
    paletteMode: "sequential",
    minSpanPoints: 10,
    inlineHeight: "medium"
  },
  graph: {
    placement: "span_allowed",
    paletteMode: "categorical",
    minSpanPoints: 10,
    inlineHeight: "medium"
  },
  sankey: {
    placement: "span_allowed",
    paletteMode: "categorical",
    minSpanPoints: 8,
    inlineHeight: "medium"
  },
  network: {
    placement: "span_preferred",
    paletteMode: "categorical",
    minSpanPoints: 10,
    inlineHeight: "large"
  },
  table: {
    placement: "span_allowed",
    paletteMode: "sequential",
    minSpanPoints: 8,
    inlineHeight: "medium"
  },
  plain_table: {
    placement: "span_allowed",
    paletteMode: "sequential",
    minSpanPoints: 8,
    inlineHeight: "medium"
  },
  flow: {
    placement: "span_allowed",
    paletteMode: "categorical",
    minSpanPoints: 6,
    inlineHeight: "medium"
  },
  multi_panel: {
    placement: "span_allowed",
    paletteMode: "categorical",
    minSpanPoints: 8,
    inlineHeight: "medium"
  },
  formula: {
    placement: "single_only",
    paletteMode: "sequential",
    minSpanPoints: 99,
    inlineHeight: "compact"
  }
};

export function normalizeFigureLayout(
  figure: PaperFigure,
  columnMode: "single" | "double"
): PaperFigure {
  if (columnMode === "single") return figure;
  const config = chartConfigs[figure.chartType];
  const points = figureInformationPoints(figure);
  const wantsSpan = figure.layout.includes("span") || figure.layout.includes("grid");
  const canSpan =
    config.placement === "span_preferred" ||
    (config.placement === "span_allowed" && points >= config.minSpanPoints);

  if (!wantsSpan || canSpan) return figure;
  return {
    ...figure,
    layout: "double_column_small"
  };
}

export function figureInformationPoints(figure: PaperFigure): number {
  if (figure.data?.kind === "series" || figure.data?.kind === "ranked") {
    return figure.data.values.length;
  }
  if (figure.data?.kind === "table") {
    return figure.data.rows.length * Math.max(1, figure.data.headers.length);
  }
  if (figure.data?.kind === "network") {
    return figure.data.nodes.length + figure.data.links.length;
  }
  if (figure.data?.kind === "matrix") {
    return figure.data.values.length * Math.max(1, figure.data.values[0]?.length ?? 0);
  }
  if (figure.data?.kind === "scatter") {
    return figure.data.points.length;
  }
  if (figure.data?.kind === "multi_series") {
    return figure.data.labels.length * figure.data.series.length;
  }
  if (figure.data?.kind === "gantt") {
    return figure.data.tasks.length;
  }
  if (figure.data?.kind === "candlestick") {
    return figure.data.values.length;
  }
  if (figure.data?.kind === "sankey") {
    return figure.data.nodes.length + figure.data.links.length;
  }
  if (figure.data?.kind === "flow") {
    return figure.data.nodes.length + figure.data.links.length;
  }
  return 0;
}

export function compactInlineLayouts(figures: PaperFigure[], columnMode: "single" | "double"): PaperFigure[] {
  return figures.map((figure) => normalizeFigureLayout(figure, columnMode));
}

export function figureLayoutUnits(figure: PaperFigure): 1 | 2 {
  return figure.layout.includes("span") || figure.layout.includes("grid") ? 2 : 1;
}

export function packFiguresByUnits(figures: PaperFigure[], capacity = 4): PaperFigure[] {
  const packed: PaperFigure[] = [];
  let used = 0;
  for (const figure of figures) {
    const units = figureLayoutUnits(figure);
    if (used + units > capacity) break;
    packed.push(figure);
    used += units;
  }
  return packed;
}

export function spanLayoutForChart(
  chartType: PaperFigure["chartType"],
  dataPoints: number,
  fallback: FigureLayoutType
): FigureLayoutType {
  const config = chartConfigs[chartType];
  if (config.placement === "single_only") return "double_column_small";
  if (config.placement === "span_preferred") return fallback;
  return dataPoints >= config.minSpanPoints ? fallback : "double_column_small";
}
