import type { FigureLayoutType, PageRole } from "../../common/types";

const baseScores: Record<PageRole, number> = {
  cover: 0.74,
  abstract: 0.78,
  teaser: 0.96,
  text: 0.62,
  figure: 0.9,
  table: 0.88,
  formula: 0.86,
  references: 0.82,
  appendix: 0.72
};

const layoutBonus: Partial<Record<FigureLayoutType, number>> = {
  double_span_teaser: 0.12,
  double_span_figure: 0.1,
  double_span_with_insets: 0.1,
  double_grid_four: 0.08,
  single_table_figure_mix: 0.07,
  double_column_small: 0.04,
  single_full_width: 0.04
};

export function scorePage(role: PageRole, layout?: FigureLayoutType, density = 0.5): number {
  const base = baseScores[role];
  const densityBonus = role === "text" ? Math.min(0.13, density * 0.16) : 0;
  const score = base + (layout ? layoutBonus[layout] ?? 0 : 0) + densityBonus;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}
