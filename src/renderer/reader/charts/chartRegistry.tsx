import type { ChartTemplate } from "./chartTypes";
import type { PaperFigure } from "../../../common/types";
import type { CSSProperties } from "react";
import { figureLabels, figureValues } from "./chartData";
import { AxisBarChart } from "./templates/AxisBarChart";
import {
  CandlestickChart,
  GanttChart,
  GraphChart,
  MatrixChart,
  MultiSeriesBarChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart
} from "./templates/AdvancedCharts";
import { FlowChart } from "./templates/FlowChart";
import { HeatmapChart } from "./templates/HeatmapChart";
import { MultiPanelChart } from "./templates/MultiPanelChart";
import { RankedBars } from "./templates/RankedBars";
import { SeriesChart } from "./templates/SeriesChart";
import { TableChart } from "./templates/TableChart";
import { WordCloudChart } from "./templates/WordCloudChart";

type ChartTemplateEntry = {
  matches: (figure: PaperFigure) => boolean;
  render: ChartTemplate;
};

const fallbackTemplate: ChartTemplate = ({ figure, palette }) => (
  <AxisBarChart
    labels={figureLabels(figure)}
    values={figureValues(figure)}
    fallbackOffset={figure.number}
    palette={palette}
  />
);

const chartTemplates: ChartTemplateEntry[] = [
  {
    matches: (figure) => figure.chartType === "formula",
    render: ({ figure, palette, isChinese }) => <FormulaChart figure={figure} palette={palette} isChinese={isChinese} />
  },
  {
    matches: (figure) => figure.chartType === "word_cloud" && figure.data?.kind === "ranked",
    render: ({ figure, palette }) =>
      figure.data?.kind === "ranked" ? (
        <WordCloudChart
          labels={figure.data.labels}
          values={figure.data.values}
          palette={palette}
          anonymize={figure.layout.includes("span") || figure.layout.includes("grid")}
        />
      ) : (
        fallbackTemplate({ figure, palette, isChinese: false })
      )
  },
  {
    matches: (figure) => figure.chartType === "matrix",
    render: ({ figure, palette }) => <MatrixChart figure={figure} palette={palette} />
  },
  {
    matches: (figure) => figure.chartType === "pie",
    render: ({ figure, palette }) => <PieChart figure={figure} palette={palette} />
  },
  {
    matches: (figure) => figure.chartType === "scatter",
    render: ({ figure, palette }) => <ScatterChart figure={figure} palette={palette} />
  },
  {
    matches: (figure) => figure.chartType === "gantt",
    render: ({ figure, palette }) => <GanttChart figure={figure} palette={palette} />
  },
  {
    matches: (figure) => figure.chartType === "grouped_bar",
    render: ({ figure, palette }) => <MultiSeriesBarChart figure={figure} palette={palette} stacked={false} />
  },
  {
    matches: (figure) => figure.chartType === "stacked_bar",
    render: ({ figure, palette }) => <MultiSeriesBarChart figure={figure} palette={palette} stacked />
  },
  {
    matches: (figure) => figure.chartType === "candlestick",
    render: ({ figure, palette }) => <CandlestickChart figure={figure} palette={palette} />
  },
  {
    matches: (figure) => figure.chartType === "radar",
    render: ({ figure, palette }) => <RadarChart figure={figure} palette={palette} />
  },
  {
    matches: (figure) => figure.chartType === "graph" || figure.chartType === "network",
    render: ({ figure, palette }) => <GraphChart figure={figure} palette={palette} />
  },
  {
    matches: (figure) => figure.chartType === "sankey",
    render: ({ figure, palette }) => <SankeyChart figure={figure} palette={palette} />
  },
  {
    matches: (figure) => figure.data?.kind === "ranked",
    render: ({ figure, palette }) =>
      figure.data?.kind === "ranked" ? (
        <RankedBars labels={figure.data.labels} values={figure.data.values} palette={palette} />
      ) : (
        fallbackTemplate({ figure, palette, isChinese: false })
      )
  },
  {
    matches: (figure) => (figure.chartType === "line" || figure.chartType === "area") && figure.data?.kind === "series",
    render: ({ figure, palette }) =>
      (figure.chartType === "line" || figure.chartType === "area") && figure.data?.kind === "series" ? (
        <SeriesChart labels={figure.data.labels} values={figure.data.values} palette={palette} variant={figure.chartType} />
      ) : (
        fallbackTemplate({ figure, palette, isChinese: false })
      )
  },
  {
    matches: (figure) => figure.chartType === "heatmap" && figure.data?.kind === "series",
    render: ({ figure, palette }) =>
      figure.data?.kind === "series" ? (
        <HeatmapChart labels={figure.data.labels} values={figure.data.values} palette={palette} />
      ) : (
        fallbackTemplate({ figure, palette, isChinese: false })
      )
  },
  {
    matches: (figure) => figure.chartType === "table" || figure.chartType === "plain_table",
    render: ({ figure, isChinese }) => <TableChart figure={figure} isChinese={isChinese} />
  },
  {
    matches: (figure) => figure.chartType === "flow",
    render: ({ figure, palette, isChinese }) => <FlowChart figure={figure} isChinese={isChinese} palette={palette} />
  },
  {
    matches: (figure) => figure.chartType === "multi_panel",
    render: ({ figure, palette }) => <MultiPanelChart figure={figure} palette={palette} />
  }
];

export function resolveChartTemplate({ figure }: Parameters<ChartTemplate>[0]): ChartTemplate {
  return chartTemplates.find((template) => template.matches(figure))?.render ?? fallbackTemplate;
}

function FormulaChart({
  figure,
  palette,
  isChinese
}: {
  figure: PaperFigure;
  palette: string[];
  isChinese: boolean;
}): JSX.Element {
  const formulas = [
    ["Ψᵢ = ∑ λₖ·xₖ / (1 + δ)"],
    ["Ω(t) = α·μₜ + β·σ² - γ"],
    ["P(z|θ) ∝ exp(ηᵀφ(z))", "θ* = argmax L(θ)"],
    ["Rₙ = √(Σᵢ wᵢ·Δᵢ²)"],
    ["L(θ) = ∏ p(xᵢ|θ) + ε", "∂L/∂θ ≈ μₜ - γ"],
    ["κ = (AᵀA + λI)⁻¹Aᵀy"]
  ];
  const formula = formulas[Math.abs(figure.number) % formulas.length];
  return (
    <div className="formula-chart" style={{ "--formula-accent": palette[figure.number % palette.length] } as CSSProperties}>
      <span>
        {formula.map((line) => (
          <b key={line}>{line}</b>
        ))}
      </span>
      <small>({(Math.abs(figure.number) % 9) + 1})</small>
    </div>
  );
}
