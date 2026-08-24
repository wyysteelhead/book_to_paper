import type { ChartType, PaperDocument, PaperFigure, PaperPage } from "../../common/types";

type ParagraphItem = {
  marker?: string;
  text: string;
};

type TextPageDraft = {
  page: PaperPage;
  items: ParagraphItem[];
};

type PageMeasurement = {
  blank: number;
  firstFragmentHeight: number;
  fragmentHeights: number[];
  overflow: number;
};

const OVERFLOW_TOLERANCE = 8;
const BLANK_PULL_THRESHOLD = 72;
const FIT_PADDING = 24;
const FILLER_THRESHOLD = 190;
const MAX_FILLER_FIGURES_PER_PAGE = 2;
const MAX_TOTAL_FIGURES_PER_PAGE = 4;

export function refineDocumentByMeasurements(
  documentData: PaperDocument,
  options: { enabledChartTypes?: ChartType[] } = {}
): PaperDocument | null {
  const pageDrafts = [...documentData.pages];
  const drafts = pageDrafts.map((page) =>
    page.role === "text" ? createTextPageDraft(page) : null
  );
  const measurements = measureTextPages(pageDrafts);
  let changed = false;

  for (let index = 0; index < pageDrafts.length; index += 1) {
    const draft = drafts[index];
    const measurement = measurements.get(pageDrafts[index].id);
    if (!draft || !measurement) continue;

    if (measurement.overflow > OVERFLOW_TOLERANCE && draft.items.length > 0) {
      if (measurement.overflow > 22 && removeLastFigure(draft)) {
        changed = true;
        break;
      }
      const nextIndex = ensureNextTextDraft(pageDrafts, drafts, index);
      const nextDraft = drafts[nextIndex];
      if (!nextDraft) continue;
      moveOverflowTail(draft, nextDraft, measurement);
      changed = true;
      break;
    }

    if (measurement.blank > BLANK_PULL_THRESHOLD) {
      const nextIndex = findNextTextDraftIndex(drafts, index);
      const nextDraft = nextIndex >= 0 ? drafts[nextIndex] : null;
      const nextMeasurement = nextIndex >= 0 ? measurements.get(pageDrafts[nextIndex].id) : null;
      const firstItem = nextDraft?.items[0];
      if (nextDraft && firstItem && nextDraft.items.length > 1 && nextMeasurement) {
        if (nextMeasurement.firstFragmentHeight + FIT_PADDING <= measurement.blank) {
          draft.items.push(firstItem);
          nextDraft.items.shift();
          changed = true;
          break;
        }
      }

      if (nextDraft && firstItem && measurement.blank > 140) {
        const split = splitLeadingItemForBlank(firstItem, measurement.blank, nextMeasurement?.firstFragmentHeight ?? 0);
        if (split) {
          draft.items.push(split.head);
          nextDraft.items[0] = split.tail;
          changed = true;
          break;
        }
      }
    }

    if (measurement.blank > FILLER_THRESHOLD && canAddFillerFigure(draft.page)) {
      const nextPage = appendFillerFigure(draft.page, measurement.blank, options.enabledChartTypes);
      if (nextPage !== draft.page) {
        draft.page = nextPage;
        changed = true;
        break;
      }
    }
  }

  if (!changed) return null;

  const pages = rebuildPages(pageDrafts, drafts);
  return {
    ...documentData,
    pages,
    chapterAnchors: rebuildChapterAnchors(documentData, pages)
  };
}

function removeLastFigure(draft: TextPageDraft): boolean {
  const figures = draft.page.figures ?? (draft.page.figure ? [draft.page.figure] : []);
  if (figures.length === 0) return false;

  const nextFigures = figures.slice(0, -1);
  draft.page = {
    ...draft.page,
    figure: nextFigures[0],
    figures: nextFigures.length > 0 ? nextFigures : undefined,
    figureLayout: nextFigures[0]?.layout
  };
  return true;
}

function moveOverflowTail(
  draft: TextPageDraft,
  nextDraft: TextPageDraft,
  measurement: PageMeasurement
): void {
  const heights = measurement.fragmentHeights.length > 0 ? measurement.fragmentHeights : [measurement.firstFragmentHeight || 48];
  const moved: ParagraphItem[] = [];
  let removedHeight = 0;

  for (let index = heights.length - 1; index >= 0; index -= 1) {
    const item = draft.items[index];
    if (!item) continue;

    const itemHeight = Math.max(heights[index] || measurement.firstFragmentHeight || 48, 24);
    const requiredHeight = measurement.overflow + FIT_PADDING - removedHeight;
    const split = splitOverflowItem(item, requiredHeight, itemHeight);

    if (split) {
      draft.items.splice(index, 1, split.head);
      moved.unshift(split.tail, ...moved);
      break;
    }

    const [wholeItem] = draft.items.splice(index, 1);
    if (wholeItem) moved.unshift(wholeItem);
    removedHeight += itemHeight;

    if (removedHeight >= measurement.overflow + FIT_PADDING || draft.items.length <= 1) break;
  }

  if (moved.length === 0 && draft.items.length > 1) {
    const fallback = draft.items.pop();
    if (fallback) moved.push(fallback);
  }

  nextDraft.items.unshift(...moved);
}

function splitOverflowItem(
  item: ParagraphItem,
  requiredHeight: number,
  itemHeight: number
): { head: ParagraphItem; tail: ParagraphItem } | null {
  const text = item.text.trim();
  if (text.length < 80) return null;

  const suffixRatio = clamp(requiredHeight / itemHeight, 0.18, 0.72);
  const splitIndex = findParagraphSplitIndex(text, Math.round(text.length * (1 - suffixRatio)));
  if (splitIndex < 30 || text.length - splitIndex < 30) return null;

  const headText = text.slice(0, splitIndex).trim();
  const tailText = text.slice(splitIndex).trim();
  if (!headText || !tailText) return null;

  return {
    head: { ...item, text: headText },
    tail: { text: tailText }
  };
}

function splitLeadingItemForBlank(
  item: ParagraphItem,
  blank: number,
  itemHeight: number
): { head: ParagraphItem; tail: ParagraphItem } | null {
  const text = item.text.trim();
  if (text.length < 100) return null;
  const estimatedHeight = Math.max(itemHeight, estimateFragmentHeight(text));
  const prefixRatio = clamp((blank - FIT_PADDING) / estimatedHeight, 0.16, 0.58);
  const splitIndex = findParagraphSplitIndex(text, Math.round(text.length * prefixRatio));
  if (splitIndex < 30 || text.length - splitIndex < 40) return null;

  const headText = text.slice(0, splitIndex).trim();
  const tailText = text.slice(splitIndex).trim();
  if (!headText || !tailText) return null;

  return {
    head: { ...item, text: headText },
    tail: { text: tailText }
  };
}

function estimateFragmentHeight(text: string): number {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  const weightedLength = text.length + chineseChars * 0.4;
  return Math.max(32, Math.ceil(weightedLength / 34) * 18);
}

function findParagraphSplitIndex(text: string, targetIndex: number): number {
  const boundedTarget = Math.max(24, Math.min(text.length - 24, targetIndex));
  const punctuation = /[。！？；，、,.!?;]/g;
  let best = boundedTarget;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const match of text.matchAll(punctuation)) {
    if (match.index === undefined) continue;
    const candidate = match.index + 1;
    if (candidate < 24 || candidate > text.length - 24) continue;
    const distance = Math.abs(candidate - boundedTarget);
    if (distance < bestDistance && distance < Math.max(40, text.length * 0.18)) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ensureNextTextDraft(
  pages: PaperPage[],
  drafts: Array<TextPageDraft | null>,
  index: number
): number {
  const nextIndex = findNextTextDraftIndex(drafts, index);
  if (nextIndex !== -1) return nextIndex;

  const source = pages[index];
  const insertedPage: PaperPage = {
    ...source,
    id: `${source.id}-overflow-${Date.now()}`,
    paragraphs: [],
    sectionMarkers: [],
    figure: undefined,
    figures: undefined,
    figureLayout: undefined,
    workScore: source.workScore
  };
  pages.splice(index + 1, 0, insertedPage);
  drafts.splice(index + 1, 0, {
    page: insertedPage,
    items: []
  });
  return index + 1;
}

function canAddFillerFigure(page: PaperPage): boolean {
  const figures = page.figures ?? (page.figure ? [page.figure] : []);
  const fillerCount = figures.filter((figure) => figure.id.startsWith("filler-")).length;
  return fillerCount < MAX_FILLER_FIGURES_PER_PAGE && figures.length < MAX_TOTAL_FIGURES_PER_PAGE;
}

function appendFillerFigure(page: PaperPage, blank: number, enabledChartTypes: ChartType[] | undefined): PaperPage {
  const figures = page.figures ?? (page.figure ? [page.figure] : []);
  const filler = createFillerFigure(page, figures.length, blank, enabledChartTypes);
  if (!filler) return page;
  const nextFigures = [...figures, filler];
  return {
    ...page,
    figure: nextFigures[0],
    figures: nextFigures,
    figureLayout: nextFigures[0]?.layout,
    workScore: Math.min(0.98, page.workScore + 0.03)
  };
}

function createFillerFigure(
  page: PaperPage,
  offset: number,
  blank: number,
  enabledChartTypes: ChartType[] | undefined
): PaperFigure | null {
  const seed = page.index * 17 + offset * 31 + Math.round(blank);
  const chartType = fillerChartType(seed, blank, enabledChartTypes);
  if (!chartType) return null;
  return {
    id: `filler-${page.id}-${offset}-${seed}`,
    number: 80 + ((seed + offset) % 90),
    layout: page.templateId === "double-column-conference" ? "double_column_small" : "single_full_width",
    title: fillerTitle(chartType, page.language, seed),
    caption: fillerCaption(chartType, page.language),
    chartType,
    data: fillerData(chartType, seed, page.language),
    sourceChapterId: page.sourceChapterId,
    workScoreBonus: 0.04
  };
}

function fillerChartType(seed: number, blank: number, enabledChartTypes: ChartType[] | undefined): PaperFigure["chartType"] | null {
  const enabled = enabledChartTypes ? new Set(enabledChartTypes) : null;
  if (blank > 340 && seed % 4 === 0 && (!enabled || enabled.has("plain_table"))) return "plain_table";
  const allTypes = ["line", "bar", "heatmap", "radar", "pie", "scatter", "plain_table"] as const;
  const types: PaperFigure["chartType"][] = allTypes.filter((type) => !enabled || enabled.has(type));
  return types[Math.abs(seed) % Math.max(1, types.length)] ?? null;
}

function fillerTitle(type: PaperFigure["chartType"], language: PaperPage["language"], seed: number): string {
  const zh: Record<string, string> = {
    line: "局部阅读信号曲线",
    bar: "补充章节指标",
    heatmap: "局部密度热力图",
    radar: "文本指纹雷达图",
    pie: "词项占比摘要",
    scatter: "片段分布散点图",
    plain_table: "补充统计表"
  };
  const en: Record<string, string> = {
    line: "Local Signal Curve",
    bar: "Supplementary Section Metrics",
    heatmap: "Local Density Heatmap",
    radar: "Text Fingerprint Radar",
    pie: "Term Share Summary",
    scatter: "Fragment Distribution Scatter",
    plain_table: "Supplementary Statistics"
  };
  return `${language === "zh" ? zh[type] : en[type]} ${seed % 3 === 0 ? "" : ""}`.trim();
}

function fillerCaption(type: PaperFigure["chartType"], language: PaperPage["language"]): string {
  if (language === "zh") {
    return type === "plain_table"
      ? "补充表格用于汇总当前页附近的文本结构指标。"
      : "补充图表用于填充页面剩余区域，并呈现当前页附近的局部文本信号。";
  }
  return type === "plain_table"
    ? "Supplementary table summarizing nearby textual structure indicators."
    : "Supplementary figure fills remaining page space with local textual signals.";
}

function fillerData(type: PaperFigure["chartType"], seed: number, language: PaperPage["language"]): PaperFigure["data"] {
  if (type === "plain_table") {
    const headers = language === "zh" ? ["指标", "值", "权重"] : ["Metric", "Value", "Weight"];
    return {
      kind: "table",
      headers,
      rows: Array.from({ length: 3 + (seed % 3) }).map((_, index) => [
        language === "zh" ? `信号 ${index + 1}` : `Signal ${index + 1}`,
        20 + ((seed + index * 11) % 70),
        Number((0.32 + ((seed + index) % 7) / 10).toFixed(2))
      ])
    };
  }
  if (type === "pie") {
    const labels = labelsFor(language, 4 + (seed % 4));
    return {
      kind: "ranked",
      labels,
      values: labels.map((_, index) => 18 + ((seed + index * 9) % 44))
    };
  }
  if (type === "scatter") {
    return {
      kind: "scatter",
      points: Array.from({ length: 12 + (seed % 12) }).map((_, index) => ({
        x: 10 + index * 5,
        y: 12 + ((seed + index * 13) % 78),
        size: 1 + ((seed + index) % 5)
      }))
    };
  }
  return {
    kind: "series",
    labels: labelsFor(language, type === "heatmap" ? 8 + (seed % 8) : 5 + (seed % 6)),
    values: labelsFor(language, type === "heatmap" ? 8 + (seed % 8) : 5 + (seed % 6)).map(
      (_, index) => 16 + ((seed + index * 7) % 72)
    )
  };
}

function labelsFor(language: PaperPage["language"], count: number): string[] {
  const labels =
    language === "zh"
      ? ["结构", "密度", "转移", "复现", "节奏", "线索", "回收", "语气", "场景", "残差", "样本", "阈值"]
      : ["Struct", "Density", "Shift", "Repeat", "Rhythm", "Cue", "Return", "Tone", "Scene", "Residual", "Sample", "Gate"];
  return labels.slice(0, count);
}

function createTextPageDraft(page: PaperPage): TextPageDraft {
  const markers = new Map(
    (page.sectionMarkers ?? []).map((marker) => [marker.paragraphIndex, marker.title])
  );
  return {
    page,
    items: (page.paragraphs ?? []).map((text, index) => ({
      marker: markers.get(index),
      text
    }))
  };
}

function measureTextPages(pages: PaperPage[]): Map<string, PageMeasurement> {
  const result = new Map<string, PageMeasurement>();
  const pageElements = Array.from(
    window.document.querySelectorAll<HTMLElement>("[data-page-role='text'][data-page-id]")
  );

  for (const pageElement of pageElements) {
    const pageId = pageElement.dataset.pageId;
    if (!pageId || !pages.some((page) => page.id === pageId)) continue;
    const content = pageElement.querySelector<HTMLElement>("[data-page-content='text']");
    if (!content) continue;
    const firstFragment = content.querySelector<HTMLElement>(".text-fragment");
    const fragmentHeights = Array.from(content.querySelectorAll<HTMLElement>(".text-fragment")).map(
      (fragment) => fragment.getBoundingClientRect().height
    );
    const contentHeight = content.scrollHeight;
    const safeHeight = content.clientHeight || content.getBoundingClientRect().height;
    result.set(pageId, {
      blank: safeHeight - contentHeight,
      firstFragmentHeight: firstFragment?.getBoundingClientRect().height ?? 0,
      fragmentHeights,
      overflow: contentHeight - safeHeight
    });
  }

  return result;
}

function findNextTextDraftIndex(drafts: Array<TextPageDraft | null>, index: number): number {
  for (let nextIndex = index + 1; nextIndex < drafts.length; nextIndex += 1) {
    if (drafts[nextIndex]) return nextIndex;
  }
  return -1;
}

function rebuildPages(
  pages: PaperPage[],
  drafts: Array<TextPageDraft | null>
): PaperPage[] {
  return pages.map((page, index) => {
    const draft = drafts[index];
    const rebuilt =
      draft && draft.items.length > 0
        ? {
            ...draft.page,
            paragraphs: draft.items.map((item) => item.text),
            sectionMarkers: draft.items
              .map((item, paragraphIndex) =>
                item.marker ? { paragraphIndex, title: item.marker } : null
              )
              .filter((marker): marker is { paragraphIndex: number; title: string } => Boolean(marker))
          }
        : page;

    return {
      ...rebuilt,
      index,
      id: rebuilt.role === "text" ? `page-text-measured-${index}` : rebuilt.id
    };
  });
}

function rebuildChapterAnchors(documentData: PaperDocument, pages: PaperPage[]): PaperDocument["chapterAnchors"] {
  return documentData.chapterAnchors.map((anchor) => {
    const page = pages.find((candidate) => candidate.sourceChapterId === anchor.id) ?? pages[anchor.pageIndex];
    return {
      ...anchor,
      pageId: page?.id ?? anchor.pageId,
      pageIndex: page?.index ?? anchor.pageIndex
    };
  });
}
