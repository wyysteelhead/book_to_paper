import type { PaperFigure } from "../../../common/types";
import { pickFigurePalette } from "./palettes";
import { resolveChartTemplate } from "./chartRegistry";

export function ChartRenderer({ figure }: { figure: PaperFigure }): JSX.Element {
  const isChinese = figure.caption.startsWith("图 ");
  const palette = pickFigurePalette(figure);

  const Template = resolveChartTemplate({ figure, isChinese, palette });
  return <Template figure={figure} isChinese={isChinese} palette={palette} />;
}
