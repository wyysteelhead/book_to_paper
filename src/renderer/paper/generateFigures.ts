import type {
  FigureLayoutType,
  DocumentLanguage,
  BookStats,
  PaperFigure,
  PaperTemplate,
  ParsedBook,
  ChartType,
  CustomChartTemplate
} from "../../common/types";
import { normalizeFigureLayout, spanLayoutForChart } from "./chartConfigs";

export function generateFigures(
  book: ParsedBook,
  template: PaperTemplate,
  language: DocumentLanguage,
  stats?: BookStats,
  options: { enabledChartTypes?: ChartType[]; customChartTemplates?: CustomChartTemplate[] } = {}
): PaperFigure[] {
  const layouts = template.defaultFigureLayouts;
  const chapterCount = Math.max(book.chapters.length, 1);
  const orderSeed = stableHash(`${book.id}:${book.title}:${chapterCount}:${book.chapters[0]?.paragraphs[0]?.slice(0, 80) ?? ""}`);
  const figures: PaperFigure[] = [];

  const enabledTypes = normalizeEnabledTypes(options.enabledChartTypes);
  const customFigures = createCustomTemplateFigures(options.customChartTemplates, template, language);
  figures.push(...customFigures);
  const statFigures = createStatFigures(stats, template, language).filter((figure) =>
    enabledTypes.has(figure.chartType)
  );
  figures.push(...statFigures);

  const syntheticTarget = Math.min(72, Math.max(chapterCount * 3, 36));
  for (let index = figures.length; index < syntheticTarget; index += 1) {
    const chapter = book.chapters[index % chapterCount];
    const chartType = syntheticChartType(index, enabledTypes);
    if (!chartType) continue;
    const data = syntheticData(index, language, chartType);
    const layout = normalizeLayoutForGeneratedChart(
      chooseSyntheticLayout(layouts, index, template.columnMode),
      chartType,
      data,
      template.columnMode
    );
    figures.push({
      id: `figure-${index + 1}`,
      number: index + 1,
      layout,
      title: figureTitle(index, language),
      caption: figureCaption(index, language),
      chartType,
      data,
      sourceChapterId: chapter?.id,
      workScoreBonus: layout.includes("span") || layout.includes("grid") ? 0.1 : 0.05
    });
  }

  return stableShuffle(figures, orderSeed)
    .map((figure, index) => ({
      ...figure,
      number: index + 1
    }))
    .map((figure) => normalizeFigureLayout(figure, template.columnMode));
}

function createCustomTemplateFigures(
  templates: CustomChartTemplate[] | undefined,
  template: PaperTemplate,
  language: DocumentLanguage
): PaperFigure[] {
  return (templates ?? [])
    .filter((item) => item.enabled !== false)
    .map((item, index) => {
      const figure = item.figure;
      return normalizeFigureLayout(
        {
          ...figure,
          id: `custom-template-${item.id}-${index}`,
          number: index + 1,
          layout: template.columnMode === "double"
            ? figure.layout
            : figure.layout === "double_column_small"
              ? "single_full_width"
              : figure.layout,
          title: figure.title || item.name || (language === "zh" ? "自定义论文组件" : "Custom Paper Component"),
          caption: figure.caption || (language === "zh" ? "图 0. 自定义模板生成的论文组件。" : "Figure 0. Custom paper component generated from template."),
          chartType: figure.chartType ?? "custom",
          data: figure.data ?? { kind: "custom", props: {} },
          workScoreBonus: figure.workScoreBonus ?? 0.08
        },
        template.columnMode
      );
    });
}

function createStatFigures(
  stats: BookStats | undefined,
  template: PaperTemplate,
  language: DocumentLanguage
): PaperFigure[] {
  if (!stats) return [];
  const figures: PaperFigure[] = [];
  const layouts = template.defaultFigureLayouts;

  if (stats.topTerms?.length) {
    figures.push({
      id: "figure-stat-top-terms",
      number: 2,
      layout: layouts[0] ?? "double_column_small",
      title: language === "zh" ? "全书高频词项排序" : "Global Term Frequency Ranking",
      caption:
        language === "zh"
          ? `图 2. 基于全书文本统计得到的高频词项分布，停用词已被轻量过滤；最高频词包括 ${stats.topTerms
              .slice(0, 3)
              .map((item) => `“${item.term}”(${item.count})`)
              .join("、")}。`
          : `Figure 2. Global term frequency distribution after lightweight stop-word filtering; the leading terms are ${stats.topTerms
              .slice(0, 3)
              .map((item) => `${item.term} (${item.count})`)
              .join(", ")}.`,
      chartType: pickChartType("topTerms", "figure-stat-top-terms"),
      data: {
        kind: "ranked",
        labels: stats.topTerms.slice(0, 8).map((item) => item.term),
        values: stats.topTerms.slice(0, 8).map((item) => item.count)
      },
      workScoreBonus: 0.12
    });
  }

  if (stats.chapterLengths?.length) {
    figures.push({
      id: "figure-stat-chapter-length",
      number: figures.length + 2,
      layout: stats.chapterLengths.length >= 8 ? layouts[1] ?? "double_column_pair" : "double_column_small",
      title: language === "zh" ? "章节长度分布" : "Chapter Length Distribution",
      caption:
        language === "zh"
          ? `图 3. 各原始章节的字符规模分布；最长章节为“${longestChapter(stats.chapterLengths)?.title ?? "N/A"}”，用于定位文本结构中的长段聚集区域。`
          : `Figure 3. Character-level chapter length distribution; the longest section is "${longestChapter(stats.chapterLengths)?.title ?? "N/A"}".`,
      chartType: pickChartType("chapterLength", "figure-stat-chapter-length"),
      data: {
        kind: "series",
        labels: stats.chapterLengths.slice(0, 12).map((item) => item.title),
        values: stats.chapterLengths.slice(0, 12).map((item) => item.chars)
      },
      workScoreBonus: 0.1
    });
  }

  if (stats.weirdMetrics?.length) {
    figures.push({
      id: "figure-stat-weird-metrics",
      number: figures.length + 2,
      layout: layouts[2] ?? "double_table_span",
      title: language === "zh" ? "补充文本指纹指标" : "Supplementary Text Fingerprints",
      caption:
        language === "zh"
          ? "图 4. 若干补充性文本指纹指标，包括疑问密度、省略号频次与叙事呼吸指数。"
          : "Figure 4. Supplementary textual fingerprints including interrogative density, ellipsis frequency, and narrative breathing index.",
      chartType: "table",
      data: {
        kind: "table",
        headers: language === "zh" ? ["指标", "值"] : ["Metric", "Value"],
        rows: stats.weirdMetrics.map((item) => [item.label, item.value])
      },
      workScoreBonus: 0.11
    });
  }

  if (stats.dialogueDensity?.length || stats.punctuationDensity?.length) {
    const source = stats.dialogueDensity?.length ? stats.dialogueDensity : stats.punctuationDensity ?? [];
    figures.push({
      id: "figure-stat-density",
      number: figures.length + 2,
      layout: source.length >= 10 ? layouts[3] ?? "double_grid_four" : "double_column_small",
      title: language === "zh" ? "对话/标点密度曲线" : "Dialogue and Punctuation Density",
      caption:
        language === "zh"
          ? "图 5. 按章节估算的对话或标点密度，颜色越深表示局部文本节奏越密集，可作为叙事压缩程度的代理指标。"
          : "Figure 5. Chapter-wise dialogue or punctuation density; darker panels indicate denser local rhythm and stronger narrative compression.",
      chartType: pickChartType("density", "figure-stat-density"),
      data: {
        kind: "series",
        labels: source.slice(0, 10).map((item) => item.title),
        values: source.slice(0, 10).map((item) => item.density)
      },
      workScoreBonus: 0.1
    });
  }

  const derived = createDerivedStatFigures(stats, template, language, figures.length + 2);
  figures.push(...derived);

  return figures;
}

function createDerivedStatFigures(
  stats: BookStats,
  template: PaperTemplate,
  language: DocumentLanguage,
  startNumber: number
): PaperFigure[] {
  const chapterLengths = stats.chapterLengths ?? [];
  const terms = stats.topTerms ?? [];
  const density = stats.dialogueDensity?.length ? stats.dialogueDensity : stats.punctuationDensity ?? [];
  const figures: PaperFigure[] = [];

  if (chapterLengths.length >= 3) {
    const labels = chapterLengths.slice(0, 6).map((item) => item.title);
    figures.push({
      id: "figure-stat-matrix",
      number: startNumber + figures.length,
      layout: template.columnMode === "double" ? "double_span_figure" : "single_full_width",
      title: language === "zh" ? "章节相邻性矩阵" : "Section Affinity Matrix",
      caption:
        language === "zh"
          ? "图表使用章节长度与段落规模构造近似相关矩阵，用于伪装成皮尔森相关系数式的结构比较。"
          : "Matrix derived from chapter length and paragraph counts as a Pearson-like structural affinity proxy.",
      chartType: "matrix",
      data: {
        kind: "matrix",
        labels,
        values: labels.map((_, row) =>
          labels.map((__, column) => {
            const a = chapterLengths[row];
            const b = chapterLengths[column];
            if (row === column) return 1;
            return clampCorrelation(1 - Math.abs(a.chars - b.chars) / Math.max(a.chars, b.chars, 1));
          })
        )
      },
      workScoreBonus: 0.12
    });

    figures.push({
      id: "figure-stat-gantt",
      number: startNumber + figures.length,
      layout: "double_column_small",
      title: language === "zh" ? "章节阅读区间甘特图" : "Section Span Gantt",
      caption: language === "zh" ? "按原书章节顺序估算阅读区间长度。" : "Estimated reading spans by source chapter order.",
      chartType: "gantt",
      data: {
        kind: "gantt",
        tasks: chapterLengths.slice(0, 7).map((item, index) => {
          const start = chapterLengths.slice(0, index).reduce((sum, chapter) => sum + chapter.chars, 0);
          return { label: item.title, start, end: start + item.chars };
        })
      },
      workScoreBonus: 0.09
    });

    figures.push({
      id: "figure-stat-candle",
      number: startNumber + figures.length,
      layout: "double_column_small",
      title: language === "zh" ? "章节波动 K 线图" : "Section Volatility Candles",
      caption: language === "zh" ? "以章节长度、段落数和局部密度构造文本波动 K 线。" : "Candles encode text volatility from section length, paragraph count, and local density.",
      chartType: "candlestick",
      data: {
        kind: "candlestick",
        labels: chapterLengths.slice(0, 8).map((item) => item.title),
        values: chapterLengths.slice(0, 8).map((item, index) => {
          const base = Math.max(10, Math.round(item.chars / 100));
          const drift = (item.paragraphs % 7) + index;
          return { open: base, high: base + drift + 8, low: Math.max(1, base - drift), close: base + (index % 2 === 0 ? drift : -drift) };
        })
      },
      workScoreBonus: 0.09
    });
  }

  if (terms.length >= 3) {
    figures.push({
      id: "figure-stat-pie",
      number: startNumber + figures.length,
      layout: "double_column_small",
      title: language === "zh" ? "高频词占比" : "Term Share Composition",
      caption: language === "zh" ? "高频词项在前若干词中的相对占比。" : "Relative composition of leading terms.",
      chartType: "pie",
      data: {
        kind: "ranked",
        labels: terms.slice(0, 6).map((item) => item.term),
        values: terms.slice(0, 6).map((item) => item.count)
      },
      workScoreBonus: 0.08
    });

    figures.push({
      id: "figure-stat-graph",
      number: startNumber + figures.length,
      layout: terms.length >= 8 ? "double_span_figure" : "double_column_small",
      title: language === "zh" ? "词项共现 Graph" : "Term Co-occurrence Graph",
      caption: language === "zh" ? "以词频邻近关系构造的轻量共现网络。" : "Lightweight co-occurrence graph inferred from adjacent ranked terms.",
      chartType: "graph",
      data: {
        kind: "network",
        nodes: terms.slice(0, 8).map((item) => item.term),
        links: terms.slice(0, 8).flatMap((_, index) =>
          index < Math.min(7, terms.length - 1) ? [[index, index + 1, 1 + (terms[index].count % 3)] as [number, number, number]] : []
        )
      },
      workScoreBonus: 0.1
    });
  }

  if (chapterLengths.length >= 3 && density.length >= 3) {
    const items = chapterLengths.slice(0, Math.min(chapterLengths.length, density.length, 14));
    figures.push({
      id: "figure-stat-scatter",
      number: startNumber + figures.length,
      layout: items.length >= 16 ? "double_span_figure" : "double_column_small",
      title: language === "zh" ? "长度-密度散点图" : "Length-Density Scatter",
      caption: language === "zh" ? "章节长度与对话/标点密度之间的散点分布。" : "Scatter distribution between section length and rhythm density.",
      chartType: "scatter",
      data: {
        kind: "scatter",
        points: items.map((item, index) => ({
          x: item.chars,
          y: density[index]?.density ?? 0,
          label: item.title,
          size: item.paragraphs
        }))
      },
      workScoreBonus: 0.09
    });

    figures.push({
      id: "figure-stat-radar",
      number: startNumber + figures.length,
      layout: "double_column_small",
      title: language === "zh" ? "文本指纹雷达图" : "Text Fingerprint Radar",
      caption: language === "zh" ? "聚合章节长度、段落数、密度和高频词集中度形成雷达指标。" : "Radar axes aggregate section length, paragraphs, density, and term concentration.",
      chartType: "radar",
      data: {
        kind: "series",
        labels: language === "zh" ? ["长度", "段落", "密度", "词频", "波动", "均衡"] : ["Length", "Paragraphs", "Density", "Terms", "Volatility", "Balance"],
        values: [
          average(chapterLengths.map((item) => item.chars / 100)),
          average(chapterLengths.map((item) => item.paragraphs)),
          average(density.map((item) => item.density * 10)),
          average(terms.slice(0, 6).map((item) => item.count)),
          Math.max(...chapterLengths.map((item) => item.chars)) / 100,
          Math.max(1, 100 - (terms[0]?.count ?? 0))
        ].map((value) => Math.round(value))
      },
      workScoreBonus: 0.08
    });
  }

  if (chapterLengths.length >= 4) {
    const labels = chapterLengths.slice(0, 5).map((item) => item.title);
    figures.push({
      id: "figure-stat-grouped",
      number: startNumber + figures.length,
      layout: "double_column_small",
      title: language === "zh" ? "多指标分组柱形图" : "Grouped Multi-Metric Bars",
      caption: language === "zh" ? "按章节对比字符、段落和密度代理指标。" : "Grouped comparison of character, paragraph, and density proxies.",
      chartType: "grouped_bar",
      data: multiSeriesFromChapters(labels, chapterLengths),
      workScoreBonus: 0.1
    });

    figures.push({
      id: "figure-stat-stacked",
      number: startNumber + figures.length,
      layout: "double_column_small",
      title: language === "zh" ? "章节组成堆积条形图" : "Stacked Section Composition",
      caption: language === "zh" ? "将章节信号拆为长度、段落和残差三部分堆积展示。" : "Stacked view of length, paragraph, and residual components.",
      chartType: "stacked_bar",
      data: multiSeriesFromChapters(labels, chapterLengths),
      workScoreBonus: 0.1
    });

    figures.push({
      id: "figure-stat-sankey",
      number: startNumber + figures.length,
      layout: "double_column_small",
      title: language === "zh" ? "章节信号桑基图" : "Section Signal Sankey",
      caption: language === "zh" ? "将前后章节的规模变化转写为流量关系。" : "Flow relation induced by adjacent section scale changes.",
      chartType: "sankey",
      data: {
        kind: "sankey",
        nodes: labels.concat(labels.map((label) => `${label}′`)),
        links: labels.map((_, index) => ({
          source: index,
          target: labels.length + ((index + 1) % labels.length),
          value: 2 + (chapterLengths[index].paragraphs % 8)
        }))
      },
      workScoreBonus: 0.1
    });

    figures.push({
      id: "figure-stat-plain-table",
      number: startNumber + figures.length,
      layout: "double_column_small",
      title: language === "zh" ? "章节统计表" : "Section Statistics Table",
      caption: language === "zh" ? "单纯表格形式展示章节字符数和段落数。" : "Plain table of section characters and paragraphs.",
      chartType: "plain_table",
      data: {
        kind: "table",
        headers: language === "zh" ? ["章节", "字符", "段落"] : ["Section", "Chars", "Paras"],
        rows: chapterLengths.slice(0, 5).map((item) => [item.title, item.chars, item.paragraphs])
      },
      workScoreBonus: 0.08
    });
  }

  return figures;
}

function longestChapter(chapters: BookStats["chapterLengths"]) {
  return [...(chapters ?? [])].sort((a, b) => b.chars - a.chars)[0];
}

function figureTitle(index: number, language: DocumentLanguage): string {
  const titles =
    language === "zh"
      ? ["章节密度分布", "复现信号频率", "概念转移图谱", "章节指标对比", "局部进程剖面", "主题共现摘要"]
      : [
          "Section Density Distribution",
          "Recurring Signal Frequency",
          "Conceptual Transition Map",
          "Comparative Section Metrics",
          "Local Progression Profile",
          "Thematic Co-occurrence Summary"
        ];
  return titles[index % titles.length];
}

function figureCaption(index: number, language: DocumentLanguage): string {
  const captions =
    language === "zh"
      ? [
          "基于重构章节的段落密度归一化结果，保留局部变化以便进行横向比较。",
          "从章节局部窗口中提取复现词汇信号，并按相对位置聚合后的分布。",
          "依据重复术语、章节边界与局部文本密度推断得到的近似转移结构。",
          "在论文式分段管线下，对重构叙事单元形成的统计摘要。",
          "由段落长度、标点密度与章节顺序共同计算得到的相对进程剖面。",
          "高频术语经轻量归一化与章节聚合后的共现视图。"
        ]
      : [
          "Normalized paragraph density across reconstructed sections, with local variation preserved for comparative inspection.",
          "Distribution of recurring lexical signals extracted from section-local windows and aggregated by relative position.",
          "Approximate transition structure inferred from repeated terms, section boundaries, and local textual density.",
          "Summary statistics for reconstructed narrative units under a paper-style segmentation pass.",
          "Relative progression profile computed from paragraph length, punctuation density, and section order.",
          "Co-occurrence view of high-frequency terms after lightweight normalization and section-level aggregation."
        ];
  return language === "zh"
    ? `图 ${index + 1}. ${captions[index % captions.length]}`
    : `Figure ${index + 1}. ${captions[index % captions.length]}`;
}

function syntheticChartType(index: number, enabledTypes: Set<ChartType>): PaperFigure["chartType"] | null {
  const allTypes = [
    "bar",
    "line",
    "area",
    "matrix",
    "pie",
    "scatter",
    "gantt",
    "grouped_bar",
    "stacked_bar",
    "candlestick",
    "radar",
    "flow",
    "graph",
    "sankey",
    "plain_table",
    "heatmap",
    "multi_panel",
    "formula"
  ] as const;
  const types: PaperFigure["chartType"][] = allTypes.filter((type) => enabledTypes.has(type));
  return types[index % Math.max(1, types.length)] ?? null;
}

function normalizeEnabledTypes(enabled: ChartType[] | undefined): Set<ChartType> {
  if (!enabled) {
    return new Set([
      "bar",
      "grouped_bar",
      "stacked_bar",
      "line",
      "area",
      "pie",
      "scatter",
      "matrix",
      "gantt",
      "candlestick",
      "radar",
      "word_cloud",
      "heatmap",
      "graph",
      "sankey",
      "network",
      "table",
      "plain_table",
      "flow",
      "multi_panel",
      "formula"
    ]);
  }
  return new Set(enabled);
}

function stableShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  let state = seed || 1;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampCorrelation(value: number): number {
  return Math.max(-1, Math.min(1, value * 2 - 1));
}

function multiSeriesFromChapters(labels: string[], chapters: NonNullable<BookStats["chapterLengths"]>): PaperFigure["data"] {
  const source = chapters.slice(0, labels.length);
  return {
    kind: "multi_series",
    labels,
    series: [
      { name: "chars", values: source.map((item) => Math.round(item.chars / 100)) },
      { name: "paras", values: source.map((item) => item.paragraphs * 4) },
      { name: "resid", values: source.map((item, index) => 12 + ((item.chars + index * 17) % 40)) }
    ]
  };
}

function networkData(index: number, language: DocumentLanguage): PaperFigure["data"] {
  const allNodes =
    language === "zh"
      ? ["结构", "主题", "密度", "冲突", "回收", "线索", "语气", "场景", "阈值", "残差", "簇群"]
      : ["Structure", "Theme", "Density", "Conflict", "Return", "Cue", "Tone", "Scene", "Threshold", "Residual", "Cluster"];
  const nodes = allNodes.slice(0, seededRange(index, 5, 11));
  const mode = index % 4;
  return {
    kind: "network",
    nodes,
    links: nodes.flatMap((_, nodeIndex) => {
      const links: Array<[number, number, number]> = [];
      if (mode === 0 && nodeIndex < nodes.length - 1) links.push([nodeIndex, nodeIndex + 1, 1 + ((index + nodeIndex) % 3)]);
      if (mode === 1 && nodeIndex > 0) links.push([0, nodeIndex, 1 + ((index + nodeIndex) % 3)]);
      if (mode === 2 && nodeIndex + 2 < nodes.length) links.push([nodeIndex, nodeIndex + 2, 1 + ((index + nodeIndex) % 2)]);
      if (mode === 3) {
        if (nodeIndex < nodes.length - 1) links.push([nodeIndex, nodeIndex + 1, 1 + ((index + nodeIndex) % 3)]);
        if (nodeIndex + 3 < nodes.length && nodeIndex % 2 === 0) links.push([nodeIndex, nodeIndex + 3, 2]);
      }
      return links;
    })
  };
}

function matrixData(index: number, language: DocumentLanguage): PaperFigure["data"] {
  const allLabels =
    language === "zh"
      ? ["结构", "密度", "复现", "节奏", "冲突", "线索", "回收", "语气", "场景"]
      : ["Struct", "Density", "Repeat", "Rhythm", "Conflict", "Cue", "Return", "Tone", "Scene"];
  const labels = allLabels.slice(0, seededRange(index, 4, 9));
  return {
    kind: "matrix",
    labels,
    values: labels.map((_, row) =>
      labels.map((__, column) => (row === column ? 1 : clampCorrelation((((row + 2) * (column + index + 3)) % 11) / 10)))
    )
  };
}

function scatterData(index: number): PaperFigure["data"] {
  const count = seededRange(index, 12, 42);
  return {
    kind: "scatter",
    points: Array.from({ length: count }).map((_, pointIndex) => ({
      x: 8 + pointIndex * seededRange(index + pointIndex, 3, 8),
      y: 12 + ((pointIndex * 13 + index * 7) % 80),
      size: 1 + ((pointIndex + index) % 5)
    }))
  };
}

function ganttData(index: number, language: DocumentLanguage): PaperFigure["data"] {
  const labels = (language === "zh"
    ? ["导入", "切分", "抽取", "聚合", "分页", "复核", "校准", "归档", "回扫"]
    : ["Import", "Split", "Extract", "Merge", "Pages", "QA", "Calibrate", "Archive", "Rescan"]
  ).slice(0, seededRange(index, 4, 9));
  return {
    kind: "gantt",
    tasks: labels.map((label, taskIndex) => ({
      label,
      start: taskIndex * 9,
      end: taskIndex * 9 + 10 + ((index + taskIndex) % 8)
    }))
  };
}

function multiSeriesData(index: number, language: DocumentLanguage): PaperFigure["data"] {
  const labels = (language === "zh" ? ["一", "二", "三", "四", "五", "六", "七"] : ["I", "II", "III", "IV", "V", "VI", "VII"]).slice(0, seededRange(index, 3, 7));
  const names = (language === "zh" ? ["叙事", "主题", "密度", "转移", "残差"] : ["Narr.", "Topic", "Dense", "Shift", "Resid."]).slice(0, seededRange(index + 2, 2, 5));
  return {
    kind: "multi_series",
    labels,
    series: names.map((name, seriesIndex) => ({
      name,
      values: labels.map((_, labelIndex) => 18 + ((index + seriesIndex * 9 + labelIndex * 11) % 54))
    }))
  };
}

function candlestickData(index: number, language: DocumentLanguage): PaperFigure["data"] {
  const labels = (language === "zh"
    ? ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
    : ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]
  ).slice(0, seededRange(index, 5, 10));
  return {
    kind: "candlestick",
    labels,
    values: labels.map((_, labelIndex) => {
      const open = 20 + ((index + labelIndex * 5) % 36);
      const close = open + (labelIndex % 2 === 0 ? 8 : -6);
      return { open, close, high: Math.max(open, close) + 9, low: Math.max(2, Math.min(open, close) - 7) };
    })
  };
}

function sankeyData(index: number, language: DocumentLanguage): PaperFigure["data"] {
  const sourceLabels = language === "zh" ? ["输入", "开端", "线索"] : ["Input", "Start", "Cue"];
  const middleLabels = language === "zh"
    ? ["转折", "伏笔", "冲突", "余波", "残差", "校准"]
    : ["Turn", "Foreshadow", "Conflict", "After", "Residual", "Audit"];
  const sinkLabels = language === "zh" ? ["回收", "回声", "输出"] : ["Return", "Echo", "Output"];
  const sourceCount = seededRange(index, 2, 3);
  const middleCount = seededRange(index + 3, 4, 6);
  const sinkCount = seededRange(index + 7, 2, 3);
  const nodes = [
    ...sourceLabels.slice(0, sourceCount),
    ...middleLabels.slice(0, middleCount),
    ...sinkLabels.slice(0, sinkCount)
  ];
  const layers = [
    ...Array.from({ length: sourceCount }, () => 0),
    ...Array.from({ length: middleCount }, (_, offset) => 1 + ((offset + index) % 2)),
    ...Array.from({ length: sinkCount }, () => 3)
  ];
  const mode = index % 4;
  const links: Array<{ source: number; target: number; value: number }> = [];
  const add = (source: number, target: number, salt: number, base = 2): void => {
    if (source < 0 || target < 0 || source >= nodes.length || target >= nodes.length) return;
    if ((layers[target] ?? 0) <= (layers[source] ?? 0)) return;
    links.push({ source, target, value: base + ((index + salt * 7 + source * 3 + target) % 7) });
  };
  const sources = layers.map((layer, nodeIndex) => layer === 0 ? nodeIndex : -1).filter((nodeIndex) => nodeIndex >= 0);
  const earlyMiddle = layers.map((layer, nodeIndex) => layer === 1 ? nodeIndex : -1).filter((nodeIndex) => nodeIndex >= 0);
  const lateMiddle = layers.map((layer, nodeIndex) => layer === 2 ? nodeIndex : -1).filter((nodeIndex) => nodeIndex >= 0);
  const sinks = layers.map((layer, nodeIndex) => layer === 3 ? nodeIndex : -1).filter((nodeIndex) => nodeIndex >= 0);

  for (const source of sources) {
    for (let offset = 0; offset < 2; offset += 1) {
      add(source, earlyMiddle[(source + offset + index) % earlyMiddle.length], offset);
    }
  }

  for (const middle of earlyMiddle) {
    const targets = mode === 1 ? lateMiddle.slice().reverse() : lateMiddle;
    for (let offset = 0; offset < (mode === 2 ? 2 : 1); offset += 1) {
      add(middle, targets[(middle + offset + index) % targets.length], offset + 5);
    }
    if (mode === 3) {
      add(middle, sinks[(middle + index) % sinks.length], middle + 8, 1);
    }
  }

  for (const middle of lateMiddle) {
    for (let offset = 0; offset < 2; offset += 1) {
      add(middle, sinks[(middle + offset + index) % sinks.length], offset + 11, offset === 0 ? 2 : 1);
    }
  }

  for (const source of sources) {
    if ((source + index) % 2 === 0) {
      add(source, lateMiddle[(source + index) % lateMiddle.length], source + 17, 1);
    }
  }

  return {
    kind: "sankey",
    nodes,
    layers,
    links: links.slice(0, 28)
  };
}

function tableData(index: number, language: DocumentLanguage): PaperFigure["data"] {
  const allHeaders = language === "zh" ? ["指标", "均值", "权重", "方差", "阈值", "备注"] : ["Metric", "Mean", "Weight", "Var", "Gate", "Note"];
  const headers = allHeaders.slice(0, seededRange(index, 3, 6));
  const rowCount = seededRange(index + 4, 3, 8);
  return {
    kind: "table",
    headers,
    rows: Array.from({ length: rowCount }).map((_, rowIndex) =>
      headers.map((header, columnIndex) =>
        columnIndex === 0
          ? language === "zh" ? `信号 ${rowIndex + 1}` : `Signal ${rowIndex + 1}`
          : header === "备注" || header === "Note"
            ? `S${rowIndex + 1}`
            : 20 + ((index + rowIndex * 7 + columnIndex * 5) % 50)
      )
    )
  };
}

function syntheticData(
  index: number,
  language: DocumentLanguage,
  chartType: PaperFigure["chartType"]
): PaperFigure["data"] {
  if (chartType === "table" || chartType === "plain_table") return tableData(index, language);
  if (chartType === "matrix") return matrixData(index, language);
  if (chartType === "scatter") return scatterData(index);
  if (chartType === "gantt") return ganttData(index, language);
  if (chartType === "grouped_bar" || chartType === "stacked_bar") return multiSeriesData(index, language);
  if (chartType === "candlestick") return candlestickData(index, language);
  if (chartType === "graph" || chartType === "network") return networkData(index, language);
  if (chartType === "sankey") return sankeyData(index, language);
  if (chartType === "flow") return flowData(index, language);

  if (chartType === "pie") {
    const ranked = seriesData(index, language, seededRange(index, 4, 8));
    return {
      kind: "ranked",
      labels: ranked.labels,
      values: ranked.values
    };
  }

  if (chartType === "radar") return seriesData(index, language, seededRange(index, 5, 8));
  if (chartType === "heatmap") return seriesData(index, language, seededRange(index, 8, 18));
  if (chartType === "multi_panel") return seriesData(index, language, seededRange(index, 6, 14));
  if (chartType === "line" || chartType === "area") return seriesData(index, language, seededRange(index, 5, 14));

  return seriesData(index, language, seededRange(index, 4, 12));
}

function seriesData(index: number, language: DocumentLanguage, length: number): { kind: "series"; labels: string[]; values: number[] } {
  const labels =
    language === "zh"
      ? ["结构", "密度", "转移", "复现", "节奏", "线索", "对话", "伏笔", "回收", "场景", "语气", "冲突", "边界", "阈值", "残差", "簇群", "样本", "流量"]
      : ["Structure", "Density", "Shift", "Repeat", "Rhythm", "Cue", "Dialogue", "Foreshadow", "Return", "Scene", "Tone", "Conflict", "Boundary", "Gate", "Residual", "Cluster", "Sample", "Flow"];
  return {
    kind: "series",
    labels: labels.slice(0, length),
    values: labels.slice(0, length).map((_, itemIndex) => 18 + ((index + 3) * (itemIndex + 5)) % 72)
  };
}

function seededRange(seed: number, min: number, max: number): number {
  return min + Math.abs((seed * 1103515245 + 12345) >> 8) % (max - min + 1);
}

function flowData(index: number, language: DocumentLanguage): PaperFigure["data"] {
  const terms =
    language === "zh"
      ? ["假设层", "归一化", "门控", "采样", "扰动", "聚合", "回归", "校准", "复核"]
      : ["Hypothesis", "Normalize", "Gate", "Sample", "Perturb", "Aggregate", "Regress", "Calibrate", "Audit"];
  const count = 5 + (index % 4);
  const nodes = Array.from({ length: count }).map((_, nodeIndex) => terms[(index + nodeIndex * 2) % terms.length]);
  const variant = (["pipeline", "decision", "swimlane"] as const)[index % 3];
  const links =
    variant === "decision"
      ? nodes.flatMap((_, nodeIndex) =>
          nodeIndex === 0
            ? ([[0, 1], [0, 2]] as Array<[number, number]>)
            : nodeIndex > 0 && nodeIndex < nodes.length - 1
              ? ([[nodeIndex, nodes.length - 1]] as Array<[number, number]>)
              : []
        )
      : nodes.flatMap((_, nodeIndex) =>
          nodeIndex < nodes.length - 1 ? ([[nodeIndex, nodeIndex + 1]] as Array<[number, number]>) : []
        );
  return { kind: "flow", nodes, links, variant };
}

function chooseSyntheticLayout(
  layouts: FigureLayoutType[],
  index: number,
  columnMode: PaperTemplate["columnMode"]
): FigureLayoutType {
  if (columnMode === "double") {
    if (index % 9 === 0) return "double_span_figure";
    if (index % 7 === 0) return "double_grid_four";
    if (index % 5 === 0) return "double_column_pair";
    return "double_column_small";
  }
  return layouts[index % layouts.length] as FigureLayoutType;
}

function normalizeLayoutForGeneratedChart(
  layout: FigureLayoutType,
  chartType: PaperFigure["chartType"],
  data: PaperFigure["data"],
  columnMode: PaperTemplate["columnMode"]
): FigureLayoutType {
  if (columnMode !== "double") return layout;
  const dataPoints =
    data?.kind === "series" || data?.kind === "ranked"
      ? data.values.length
      : data?.kind === "table"
        ? data.rows.length * data.headers.length
        : 0;
  return spanLayoutForChart(chartType, dataPoints, layout);
}

function pickChartType(
  problemType: "topTerms" | "chapterLength" | "density",
  seed: string
): PaperFigure["chartType"] {
  const options = {
    topTerms: ["word_cloud", "bar"] as const,
    chapterLength: ["line", "area", "bar"] as const,
    density: ["heatmap", "multi_panel", "bar"] as const
  };
  const candidates = options[problemType];
  return candidates[hashString(seed) % candidates.length];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
