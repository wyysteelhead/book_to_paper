import type { PaperTemplate, PaperTemplateId } from "../../common/types";

export const paperTemplates: Record<PaperTemplateId, PaperTemplate> = {
  "single-column-report": {
    id: "single-column-report",
    name: "单栏技术报告",
    columnMode: "single",
    pageSize: "a4",
    defaultFigureLayouts: [
      "single_full_width",
      "single_two_panel",
      "single_three_panel",
      "single_table_figure_mix"
    ],
    teaserLayout: "single_full_width"
  },
  "double-column-conference": {
    id: "double-column-conference",
    name: "双栏会议论文",
    columnMode: "double",
    pageSize: "a4",
    defaultFigureLayouts: [
      "double_column_small",
      "double_column_small",
      "double_column_pair",
      "double_grid_four",
      "double_column_small",
      "double_span_figure",
      "double_table_span"
    ],
    teaserLayout: "double_span_teaser"
  }
};

export function getPaperTemplate(templateId: PaperTemplateId): PaperTemplate {
  return paperTemplates[templateId];
}
