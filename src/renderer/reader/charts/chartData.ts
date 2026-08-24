import type { PaperFigure } from "../../../common/types";

export function figureLabels(figure: PaperFigure): string[] | undefined {
  if (figure.data?.kind === "ranked" || figure.data?.kind === "series") {
    return figure.data.labels;
  }
  return undefined;
}

export function figureValues(figure: PaperFigure): number[] | undefined {
  if (figure.data?.kind === "ranked" || figure.data?.kind === "series") {
    return figure.data.values;
  }
  return undefined;
}

export function panelValues(figure: PaperFigure, panelIndex: number): number[] | undefined {
  const values = figureValues(figure);
  if (!values) return undefined;
  return values.slice(panelIndex * 3, panelIndex * 3 + 4);
}

export function shortLabel(label: string | undefined): string {
  if (!label) return "";
  return label.length > 8 ? `${label.slice(0, 8)}...` : label;
}
