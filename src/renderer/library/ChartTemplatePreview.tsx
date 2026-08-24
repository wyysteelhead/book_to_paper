import { Check, Code2, Copy, Plus, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import type { PaperFigure } from "../../common/types";
import { ChartRenderer } from "../reader/charts/ChartRenderer";
import { useLibraryStore } from "./libraryStore";

const chartTypes: Array<{
  type: PaperFigure["chartType"];
  label: string;
}> = [
  { type: "bar", label: "柱状图" },
  { type: "grouped_bar", label: "多系列柱形图" },
  { type: "stacked_bar", label: "堆积条形图" },
  { type: "line", label: "折线图" },
  { type: "area", label: "面积图" },
  { type: "matrix", label: "矩阵图" },
  { type: "pie", label: "饼图" },
  { type: "scatter", label: "散点图" },
  { type: "gantt", label: "甘特图" },
  { type: "candlestick", label: "K 线图" },
  { type: "radar", label: "雷达图" },
  { type: "word_cloud", label: "词云图" },
  { type: "heatmap", label: "热力图" },
  { type: "graph", label: "Graph" },
  { type: "sankey", label: "桑基图" },
  { type: "flow", label: "流程图" },
  { type: "multi_panel", label: "多面板图" },
  { type: "plain_table", label: "单纯表格" },
  { type: "formula", label: "公式" }
];

export function ChartTemplatePreview(): JSX.Element {
  const enabledChartTypes = useLibraryStore((state) => state.enabledChartTypes);
  const setChartTypeEnabled = useLibraryStore((state) => state.setChartTypeEnabled);
  const [seeds, setSeeds] = useState<Record<string, number>>(
    () => Object.fromEntries(chartTypes.map((item, index) => [item.type, 7 + index * 11]))
  );
  const [codePanel, setCodePanel] = useState<{ title: string; code: string; prompt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyCurrentCode(kind: "code" | "prompt" = "code") {
    if (!codePanel) return;
    await navigator.clipboard.writeText(kind === "code" ? codePanel.code : codePanel.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="chart-template-preview">
      <header>
        <div>
          <p className="eyebrow">Templates</p>
          <h2>图表模板预览</h2>
        </div>
        <div className="chart-preview-actions">
          <button
            className="icon-text-button"
            onClick={() => setCodePanel({ title: "新增图表模板", code: newTemplateCode(), prompt: templatePromptFor("bar") })}
          >
            <Plus size={16} />
            新增
          </button>
          <button
            className="icon-text-button"
            onClick={() =>
              setSeeds((current) =>
                Object.fromEntries(
                  chartTypes.map((item, index) => [
                    item.type,
                    (current[item.type] ?? 7 + index * 11) + 1
                  ])
                )
              )
            }
          >
            <RefreshCw size={16} />
            全部刷新
          </button>
        </div>
      </header>
      <div className="chart-gallery" aria-label="图表模板 Gallery">
        {chartTypes.map((item, index) => (
          <article className="chart-gallery-card" key={item.type}>
            <header>
              <label className="chart-enable-toggle" title={enabledChartTypes[item.type] ? "已启用" : "已停用"}>
                <input
                  type="checkbox"
                  checked={enabledChartTypes[item.type]}
                  onChange={(event) => setChartTypeEnabled(item.type, event.currentTarget.checked)}
                />
                <h3>{item.label}</h3>
              </label>
              <div className="chart-card-actions">
                <button
                  className="icon-button subtle"
                  onClick={() =>
                    setCodePanel({
                      title: `${item.label}定义`,
                      code: templateCodeFor(item.type, seeds[item.type] ?? 7 + index * 11),
                      prompt: templatePromptFor(item.type)
                    })
                  }
                  aria-label={`编辑${item.label}代码`}
                  title="编辑代码"
                >
                  <Code2 size={14} />
                </button>
                <button
                  className="icon-button subtle"
                  onClick={() =>
                    setSeeds((current) => ({
                      ...current,
                      [item.type]: (current[item.type] ?? 7 + index * 11) + 1
                    }))
                  }
                  aria-label={`刷新${item.label}`}
                  title="随机切换数据和配色"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </header>
            <div className="figure-block">
              <ChartRenderer figure={previewFigure(item.type, seeds[item.type] ?? 7 + index * 11)} />
              <p className="caption">图 0. {item.label}模板的随机数据与配色预览。</p>
            </div>
          </article>
        ))}
      </div>
      {codePanel ? (
        <div className="import-overlay" role="presentation" onMouseDown={() => setCodePanel(null)}>
          <section className="template-code-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Template Code</p>
                <h2>{codePanel.title}</h2>
              </div>
              <button className="icon-button subtle" onClick={() => setCodePanel(null)}>
                <X size={18} />
              </button>
            </header>
            <textarea
              value={codePanel.code}
              onChange={(event) => setCodePanel({ ...codePanel, code: event.currentTarget.value })}
              spellCheck={false}
            />
            <footer>
              <button className="secondary-button" onClick={() => setCodePanel(null)}>
                关闭
              </button>
              <div className="template-copy-actions">
                <button className="secondary-button" onClick={() => copyCurrentCode("prompt")}>
                  <Copy size={16} />
                  复制提示词
                </button>
                <button className="primary-button" onClick={() => copyCurrentCode("code")}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "已复制" : "复制定义"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function templateCodeFor(type: PaperFigure["chartType"], seed: number): string {
  const figure = previewFigure(type, seed);
  return `export const template = ${JSON.stringify(figure, null, 2)};\n`;
}

function newTemplateCode(): string {
  return `export const template = {
  id: "custom-template-id",
  number: 0,
  layout: "double_column_small",
  title: "自定义图表标题",
  caption: "图 0. 自定义图表说明。",
  chartType: "bar",
  data: {
    kind: "series",
    labels: ["A", "B", "C", "D"],
    values: [24, 36, 18, 42]
  },
  workScoreBonus: 0.08
};\n`;
}

function templatePromptFor(type: PaperFigure["chartType"]): string {
  return `请根据下面的 Book2Paper 图表模板格式，帮我生成一个新的 ${type} 图表 JSON。要求：
1. 只输出 JSON 对象，不要 Markdown 代码块。
2. chartType 必须是 "${type}"，layout 只能根据图表信息量选择 "double_column_small" 或 "double_span_figure"；如果是公式，必须用 "double_column_small"。
3. title 要像论文图表标题，caption 要像正式论文图注。
4. data.kind 必须与 chartType 匹配：
   - bar/line/area/heatmap/radar/multi_panel: {"kind":"series","labels":[],"values":[]}
   - pie/word_cloud: {"kind":"ranked","labels":[],"values":[]}
   - grouped_bar/stacked_bar: {"kind":"multi_series","labels":[],"series":[{"name":"","values":[]}]}
   - matrix: {"kind":"matrix","labels":[],"values":[[]]}
   - scatter: {"kind":"scatter","points":[{"x":0,"y":0,"label":"","size":1}]}
   - gantt: {"kind":"gantt","tasks":[{"label":"","start":0,"end":10}]}
   - candlestick: {"kind":"candlestick","labels":[],"values":[{"open":0,"high":1,"low":0,"close":1}]}
   - graph/network: {"kind":"network","nodes":[],"links":[[0,1,1]]}
   - sankey: {"kind":"sankey","nodes":[],"links":[{"source":0,"target":1,"value":1}]}
   - flow: {"kind":"flow","nodes":[],"links":[[0,1]],"variant":"pipeline"}
   - table/plain_table: {"kind":"table","headers":[],"rows":[[]]}
   - formula: data 可以省略
5. 请填充随机但看起来学术的数据，避免直接暴露真实书名或角色名。

示例结构：
{
  "id": "custom-template-id",
  "number": 0,
  "layout": "double_column_small",
  "title": "局部信号稳健性摘要",
  "caption": "图 0. 对重构文本窗口的局部指标进行归一化展示。",
  "chartType": "${type}",
  "data": null,
  "workScoreBonus": 0.08
}`;
}

function previewFigure(type: PaperFigure["chartType"], seed: number): PaperFigure {
  return {
    id: `preview-${type}-${seed}`,
    number: seed,
    layout: type === "matrix" || type === "graph" ? "double_span_figure" : "double_column_small",
    title: "Preview",
    caption: "图 0. 图表模板预览。",
    chartType: type,
    data: previewData(type, seed),
    workScoreBonus: 0
  };
}

function previewData(type: PaperFigure["chartType"], seed: number): PaperFigure["data"] {
  if (type === "formula") return undefined;
  if (type === "grouped_bar" || type === "stacked_bar") return multiSeries(seed);
  if (type === "matrix") return matrix(seed);
  if (type === "pie" || type === "word_cloud") return ranked(seed);
  if (type === "scatter") return scatter(seed);
  if (type === "gantt") return gantt(seed);
  if (type === "candlestick") return candle(seed);
  if (type === "graph" || type === "network") return network(seed);
  if (type === "sankey") return sankey(seed);
  if (type === "flow") return flow(seed);
  if (type === "plain_table" || type === "table") return table(seed);
  if (type === "radar") return series(seed, randomInt(seed, 5, 8));
  if (type === "heatmap") return series(seed, randomInt(seed, 8, 18));
  if (type === "multi_panel") return series(seed, randomInt(seed, 6, 14));
  if (type === "line" || type === "area") return series(seed, randomInt(seed, 5, 14));
  return series(seed, randomInt(seed, 4, 12));
}

function labels(length: number): string[] {
  const base = ["结构", "密度", "转移", "复现", "节奏", "线索", "扰动", "校准", "回收", "语气", "场景", "冲突", "边界", "流量", "残差", "聚类", "样本", "阈值"];
  return base.slice(0, length);
}

function value(seed: number, index: number): number {
  return 18 + ((seed + 5) * (index + 3)) % 72;
}

function randomInt(seed: number, min: number, max: number): number {
  return min + Math.abs((seed * 1103515245 + 12345) >> 8) % (max - min + 1);
}

function series(seed: number, length: number): PaperFigure["data"] {
  return {
    kind: "series",
    labels: labels(length),
    values: labels(length).map((_, index) => value(seed, index))
  };
}

function ranked(seed: number): PaperFigure["data"] {
  const count = randomInt(seed, 4, 10);
  return {
    kind: "ranked",
    labels: ["甲7", "乙3", "Δ12", "Σ9", "域4", "层8", "核2", "轴6", "阈5", "簇1"].slice(0, count),
    values: Array.from({ length: count }).map((_, index) => value(seed, index))
  };
}

function matrix(seed: number): PaperFigure["data"] {
  const matrixLabels = labels(randomInt(seed, 4, 9));
  return {
    kind: "matrix",
    labels: matrixLabels,
    values: matrixLabels.map((_, row) =>
      matrixLabels.map((__, column) => (row === column ? 1 : ((((row + 2) * (column + seed + 3)) % 18) - 8) / 10))
    )
  };
}

function scatter(seed: number): PaperFigure["data"] {
  const count = randomInt(seed, 12, 42);
  return {
    kind: "scatter",
    points: Array.from({ length: count }).map((_, index) => ({
      x: 8 + index * randomInt(seed + index, 3, 7),
      y: 16 + ((index * 11 + seed * 7) % 80),
      size: 1 + ((index + seed) % 5)
    }))
  };
}

function gantt(seed: number): PaperFigure["data"] {
  const count = randomInt(seed, 4, 9);
  return {
    kind: "gantt",
    tasks: labels(count).map((label, index) => ({
      label,
      start: index * randomInt(seed + index, 5, 11),
      end: index * randomInt(seed + index, 5, 11) + randomInt(seed + index * 3, 7, 20)
    }))
  };
}

function multiSeries(seed: number): PaperFigure["data"] {
  const groupLabels = ["T1", "T2", "T3", "T4", "T5", "T6", "T7"].slice(0, randomInt(seed, 3, 7));
  const seriesCount = randomInt(seed + 2, 2, 5);
  return {
    kind: "multi_series",
    labels: groupLabels,
    series: ["A", "B", "C", "D", "E"].slice(0, seriesCount).map((name, seriesIndex) => ({
      name,
      values: groupLabels.map((_, index) => value(seed + seriesIndex * 3, index))
    }))
  };
}

function candle(seed: number): PaperFigure["data"] {
  const count = randomInt(seed, 5, 12);
  return {
    kind: "candlestick",
    labels: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"].slice(0, count),
    values: Array.from({ length: count }).map((_, index) => {
      const open = 20 + ((seed + index * 5) % 36);
      const close = open + (index % 2 === 0 ? 7 : -5);
      return { open, close, high: Math.max(open, close) + 8, low: Math.max(2, Math.min(open, close) - 7) };
    })
  };
}

function network(seed: number): PaperFigure["data"] {
  const nodes = labels(randomInt(seed, 5, 11));
  const mode = seed % 4;
  return {
    kind: "network",
    nodes,
    links: nodes.flatMap((_, index) => {
      const links: Array<[number, number, number]> = [];
      if (mode === 0 && index < nodes.length - 1) links.push([index, index + 1, 1 + ((seed + index) % 3)]);
      if (mode === 1 && index > 0) links.push([0, index, 1 + ((seed + index) % 3)]);
      if (mode === 2 && index + 2 < nodes.length) links.push([index, index + 2, 1 + ((seed + index) % 2)]);
      if (mode === 3) {
        if (index < nodes.length - 1) links.push([index, index + 1, 1 + ((seed + index) % 3)]);
        if (index + 3 < nodes.length && index % 2 === 0) links.push([index, index + 3, 2]);
      }
      return links;
    })
  };
}

function sankey(seed: number): PaperFigure["data"] {
  const nodes = ["输入", "假设", "采样", "扰动", "聚合", "校准", "复核", "回归", "归档", "输出"].slice(0, randomInt(seed, 7, 10));
  const mode = seed % 3;
  const mid = Math.floor(nodes.length / 2);
  return {
    kind: "sankey",
    nodes,
    links:
      mode === 0
        ? nodes.slice(0, mid).flatMap((_, index) => [
            { source: index, target: mid + (index % (nodes.length - mid)), value: 2 + ((seed + index) % 6) },
            ...(index + 1 < mid ? [{ source: index, target: mid + ((index + 1) % (nodes.length - mid)), value: 1 + ((seed + index) % 4) }] : [])
          ])
        : mode === 1
          ? nodes.slice(1, nodes.length - 1).map((_, index) => ({
              source: index === 0 ? 0 : index,
              target: index + 1,
              value: 2 + ((seed + index) % 7)
            }))
          : nodes.slice(0, mid).flatMap((_, index) => [
              { source: 0, target: 1 + index, value: 2 + ((seed + index) % 5) },
              { source: 1 + index, target: nodes.length - 1, value: 1 + ((seed + index) % 6) }
            ])
  };
}

function flow(seed: number): PaperFigure["data"] {
  const nodes = ["假设层", "归一化", "门控", "采样", "扰动", "聚合", "校准"].slice(0, 5 + (seed % 3));
  return {
    kind: "flow",
    nodes,
    links: nodes.flatMap((_, index) => (index < nodes.length - 1 ? ([[index, index + 1]] as Array<[number, number]>) : [])),
    variant: (["pipeline", "decision", "swimlane"] as const)[seed % 3]
  };
}

function table(seed: number): PaperFigure["data"] {
  const columnCount = randomInt(seed, 3, 6);
  const rowCount = randomInt(seed + 4, 3, 8);
  const headers = ["指标", "均值", "权重", "方差", "阈值", "备注"].slice(0, columnCount);
  return {
    kind: "table",
    headers,
    rows: labels(rowCount).map((label, rowIndex) =>
      headers.map((header, columnIndex) =>
        columnIndex === 0 ? label : header === "备注" ? `S${rowIndex + 1}` : value(seed + columnIndex * 5, rowIndex)
      )
    )
  };
}
