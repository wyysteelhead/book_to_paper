import type { PaperFigure } from "../../../common/types";

export type ChartTemplateProps = {
  figure: PaperFigure;
  isChinese: boolean;
  palette: string[];
};

export type ChartTemplate = (props: ChartTemplateProps) => JSX.Element;
