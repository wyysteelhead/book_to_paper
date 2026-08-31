import type { ChartType, FigureFrequency, PaperColumn, PaperDocument, PaperFigure, PaperPage } from "../../common/types";

type ParagraphItem = {
  marker?: string;
  sourceChapterMarker?: {
    sourceChapterId: string;
    title: string;
  };
  text: string;
};

type TextPageDraft = {
  page: PaperPage;
  items: ParagraphItem[];
};

type FlowItem = ParagraphItem & {
  language: PaperPage["language"];
  sectionTitle?: string;
  sourceChapterId?: string;
  sourceProgress: number;
  workScore: number;
};

type PageMeasurement = {
  blank: number;
  firstFragmentHeight: number;
  fragmentHeights: number[];
  overflow: number;
};

export type FigureHeightMap = Record<string, number>;

const OVERFLOW_TOLERANCE = 8;
const BLANK_PULL_THRESHOLD = 72;
const FIT_PADDING = 24;
const FILLER_THRESHOLD = Number.POSITIVE_INFINITY;
const MAX_FILLER_FIGURES_PER_PAGE = 2;
const MAX_TOTAL_FIGURES_PER_PAGE = 4;
const SAFE_SINGLE_HEIGHT = 760;
const SAFE_DOUBLE_COLUMN_HEIGHT = 720;
const SAFE_MIN_TEXT_SLICE = 34;
const MIN_TEXT_WITH_SINGLE_FIGURE = 260;
const MIN_TEXT_WITH_DOUBLE_FIGURE = 360;

export function repaginateDocumentSafely(
  documentData: PaperDocument,
  options: { figureFrequency?: FigureFrequency; figureHeights?: FigureHeightMap } = {}
): PaperDocument {
  return paginateDocumentWithFiguresFirst(documentData, options);
}

export function paginateDocumentWithFiguresFirst(
  documentData: PaperDocument,
  options: { figureFrequency?: FigureFrequency; figureHeights?: FigureHeightMap } = {}
): PaperDocument {
  const sourcePages = withoutFormulaEstimatePage(documentData.pages);
  const firstTextIndex = sourcePages.findIndex((page) => page.role === "text");
  const lastTextIndex = findLastTextPageIndex(sourcePages);
  if (firstTextIndex < 0 || lastTextIndex < firstTextIndex) return documentData;

  const flow = flattenTextFlow(sourcePages.slice(firstTextIndex, lastTextIndex + 1));
  if (flow.length === 0) return documentData;

  const sourceTextPages = sourcePages.slice(firstTextIndex, lastTextIndex + 1);
  const figurePool = collectSafeInlineFigures(sourceTextPages, options.figureFrequency);
  const placementInterval = inferFigurePlacementInterval(sourceTextPages, figurePool.length, options.figureFrequency);
  const prefix = sourcePages.slice(0, firstTextIndex);
  const suffix = sourcePages.slice(lastTextIndex + 1);
  const sourcePage =
    sourcePages.find((page) => page.role === "text") ?? sourcePages[firstTextIndex];
  const textPages =
    sourcePage.templateId === "double-column-conference"
      ? buildSafeDoublePages(flow, figurePool, sourcePage, placementInterval, options.figureFrequency, options.figureHeights)
      : buildSafeSinglePages(flow, figurePool, sourcePage, placementInterval, options.figureFrequency, options.figureHeights);
  const pages = [...prefix, ...textPages, ...suffix].map((page, index) => ({
    ...page,
    index
  }));

  return {
    ...documentData,
    pages,
    chapterAnchors: rebuildChapterAnchors(documentData, pages)
  };
}

export function repaginateDocumentFromPage(
  documentData: PaperDocument,
  pageIndex: number,
  options: { figureFrequency?: FigureFrequency; figureHeights?: FigureHeightMap } = {}
): PaperDocument {
  const sourcePages = withoutFormulaEstimatePage(documentData.pages);
  const firstTextIndex = sourcePages.findIndex((page) => page.role === "text");
  const lastTextIndex = findLastTextPageIndex(sourcePages);
  if (firstTextIndex < 0 || lastTextIndex < firstTextIndex) return documentData;

  const boundedIndex = Math.max(firstTextIndex, Math.min(lastTextIndex, pageIndex));
  const reflowStartIndex = findTextReflowStartIndex(sourcePages, boundedIndex, firstTextIndex);
  const prefix = sourcePages.slice(0, reflowStartIndex);
  const suffix = sourcePages.slice(lastTextIndex + 1);
  const reflowSourcePages = sourcePages.slice(reflowStartIndex, lastTextIndex + 1);
  const flow = flattenTextFlow(reflowSourcePages);
  if (flow.length === 0) return documentData;

  const figurePool = collectSafeInlineFigures(reflowSourcePages, options.figureFrequency);
  const placementInterval = inferFigurePlacementInterval(reflowSourcePages, figurePool.length, options.figureFrequency);
  const sourcePage =
    reflowSourcePages.find((page) => page.role === "text") ??
    sourcePages[firstTextIndex];
  const textPages =
    sourcePage.templateId === "double-column-conference"
      ? buildSafeDoublePages(flow, figurePool, sourcePage, placementInterval, options.figureFrequency, options.figureHeights)
      : buildSafeSinglePages(flow, figurePool, sourcePage, placementInterval, options.figureFrequency, options.figureHeights);
  const pages = [...prefix, ...textPages, ...suffix].map((page, index) => ({
    ...page,
    id: page.role === "text" && index >= reflowStartIndex ? `${page.id}-manual-${reflowStartIndex}` : page.id,
    index
  }));

  return {
    ...documentData,
    pages,
    chapterAnchors: rebuildChapterAnchors(documentData, pages)
  };
}

function findTextReflowStartIndex(
  pages: PaperPage[],
  pageIndex: number,
  firstTextIndex: number
): number {
  for (let index = pageIndex; index >= firstTextIndex; index -= 1) {
    if (pages[index].role === "text") return index;
  }
  return firstTextIndex;
}

function withoutFormulaEstimatePage(pages: PaperPage[]): PaperPage[] {
  return pages.filter((page) => page.role !== "formula" && page.id !== "page-formula");
}

export function refineDocumentByMeasurements(
  documentData: PaperDocument,
  options: { enabledChartTypes?: ChartType[]; focusPageIndex?: number } = {}
): PaperDocument | null {
  const pageDrafts = [...documentData.pages];
  const drafts = pageDrafts.map((page) =>
    page.role === "text" ? createTextPageDraft(page) : null
  );
  const measurements = measureTextPages(pageDrafts);
  let changed = false;

  const order = refinementOrder(pageDrafts.length, options.focusPageIndex);

  for (const index of order) {
    const draft = drafts[index];
    const measurement = measurements.get(pageDrafts[index].id);
    if (!draft || !measurement) continue;

    if (measurement.overflow > OVERFLOW_TOLERANCE && draft.items.length > 0) {
      const figureCount = countFigures(draft.page);
      if ((measurement.overflow > 96 || figureCount > 2) && removeLastFigure(draft)) {
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
  }

  if (changed) {
    const pages = rebuildPages(pageDrafts, drafts);
    return {
      ...documentData,
      pages,
      chapterAnchors: rebuildChapterAnchors(documentData, pages)
    };
  }

  for (const index of order) {
    const draft = drafts[index];
    const measurement = measurements.get(pageDrafts[index].id);
    if (!draft || !measurement) continue;

    if (measurement.blank > BLANK_PULL_THRESHOLD) {
      const nextIndex = findNextTextDraftIndex(drafts, index);
      const nextDraft = nextIndex >= 0 ? drafts[nextIndex] : null;
      const nextMeasurement = nextIndex >= 0 ? measurements.get(pageDrafts[nextIndex].id) : null;
      if (nextDraft && pullForwardContentForBlank(draft, nextDraft, measurement, nextMeasurement ?? undefined)) {
        changed = true;
        break;
      }
    }

    if (
      measurement.blank > FILLER_THRESHOLD &&
      measurement.overflow <= 0 &&
      draftTextHeight(draft) >= MIN_TEXT_WITH_DOUBLE_FIGURE &&
      canAddFillerFigure(draft.page)
    ) {
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

function refinementOrder(length: number, focusPageIndex: number | undefined): number[] {
  if (focusPageIndex === undefined) {
    return Array.from({ length }, (_, index) => index);
  }

  const focus = Math.max(0, Math.min(length - 1, focusPageIndex));
  const order: number[] = [];
  for (let offset = 0; offset < length; offset += 1) {
    const forward = focus + offset;
    const backward = focus - offset;
    if (forward < length) order.push(forward);
    if (offset > 0 && backward >= 0) order.push(backward);
  }
  return order;
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

function countFigures(page: PaperPage): number {
  return page.figures?.length ?? (page.figure ? 1 : 0);
}

function draftTextHeight(draft: TextPageDraft): number {
  const mode = draft.page.templateId === "double-column-conference" ? "double" : "single";
  return draft.items.reduce((sum, item) => sum + estimateItemHeight(item, mode), 0);
}

function moveOverflowTail(
  draft: TextPageDraft,
  nextDraft: TextPageDraft,
  measurement: PageMeasurement
): void {
  const heights = measurement.fragmentHeights.length > 0 ? measurement.fragmentHeights : [measurement.firstFragmentHeight || 48];
  const moved: ParagraphItem[] = [];
  let removedHeight = 0;
  const targetRemoval = measurement.overflow + FIT_PADDING + 48;

  for (let index = heights.length - 1; index >= 0; index -= 1) {
    const item = draft.items[index];
    if (!item) continue;

    const itemHeight = Math.max(heights[index] || measurement.firstFragmentHeight || 48, 24);
    const requiredHeight = targetRemoval - removedHeight;
    const split = splitOverflowItem(item, requiredHeight, itemHeight);

    if (split) {
      draft.items.splice(index, 1, split.head);
      moved.unshift(split.tail, ...moved);
      break;
    }

    const [wholeItem] = draft.items.splice(index, 1);
    if (wholeItem) moved.unshift(wholeItem);
    removedHeight += itemHeight;

    if (removedHeight >= targetRemoval || draft.items.length <= 1) break;
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

function pullForwardContentForBlank(
  draft: TextPageDraft,
  nextDraft: TextPageDraft,
  measurement: PageMeasurement,
  nextMeasurement: PageMeasurement | undefined
): boolean {
  let changed = false;
  let remainingBlank = measurement.blank - FIT_PADDING;
  const mode = draft.page.templateId === "double-column-conference" ? "double" : "single";

  while (nextDraft.items.length > 1 && remainingBlank > BLANK_PULL_THRESHOLD) {
    const firstItem = nextDraft.items[0];
    if (!firstItem) break;
    const estimatedHeight = Math.max(estimateItemHeight(firstItem, mode), nextMeasurement?.firstFragmentHeight ?? 0, 24);
    if (estimatedHeight + FIT_PADDING > remainingBlank) break;
    draft.items.push(firstItem);
    nextDraft.items.shift();
    remainingBlank -= estimatedHeight;
    changed = true;
  }

  const firstItem = nextDraft.items[0];
  if (firstItem && remainingBlank > 140) {
    const split = splitLeadingItemForBlank(firstItem, remainingBlank, nextMeasurement?.firstFragmentHeight ?? 0);
    if (split) {
      draft.items.push(split.head);
      nextDraft.items[0] = split.tail;
      changed = true;
    }
  }

  return changed;
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

function findLastTextPageIndex(pages: PaperPage[]): number {
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    if (pages[index].role === "text") return index;
  }
  return -1;
}

function flattenTextFlow(pages: PaperPage[]): FlowItem[] {
  return pages.flatMap((page) => {
    const markers = new Map(
      (page.sectionMarkers ?? []).map((marker) => [marker.paragraphIndex, marker.title])
    );
    const sourceChapterMarkers = new Map(
      (page.sourceChapterMarkers ?? []).map((marker) => [marker.paragraphIndex, marker])
    );
    const sourceParagraphs = page.columns?.length
      ? page.columns.flatMap((column) => column.paragraphs)
      : (page.paragraphs ?? []);

    return sourceParagraphs
      .map((text, index): FlowItem | null => {
        const trimmed = text.trim();
        if (!trimmed) return null;
        return {
          marker: markers.get(index),
          sourceChapterMarker: sourceChapterMarkers.get(index),
          text: trimmed,
          language: page.language,
          sectionTitle: page.sectionTitle,
          sourceChapterId: page.sourceChapterId,
          sourceProgress: page.sourceProgress,
          workScore: page.workScore
        };
      })
      .filter((item): item is FlowItem => Boolean(item));
  });
}

function collectSafeInlineFigures(pages: PaperPage[], frequency: FigureFrequency = "high"): PaperFigure[] {
  const figures = pages
    .flatMap((page) => page.figures ?? (page.figure ? [page.figure] : []))
    .filter((figure) => figure.chartType !== "formula");
  const textPageCount = Math.max(1, pages.filter((page) => page.role === "text").length);
  const density = safeFigureDensityForFrequency(frequency);
  const maxInlineFigures = Math.max(4, Math.ceil(textPageCount * density));
  if (figures.length <= maxInlineFigures) return figures;

  const step = figures.length / maxInlineFigures;
  return Array.from({ length: maxInlineFigures }).map((_, index) => figures[Math.floor(index * step)]);
}

function safeFigureDensityForFrequency(frequency: FigureFrequency): number {
  if (frequency === "low") return 0.22;
  if (frequency === "standard") return 0.38;
  if (frequency === "high") return 0.62;
  return 0.82;
}

function inferFigurePlacementInterval(
  pages: PaperPage[],
  figureCount: number,
  frequency: FigureFrequency = "high"
): number {
  if (figureCount <= 0) return Number.POSITIVE_INFINITY;
  if (frequency === "dense") return 1;
  if (frequency === "high") return 1;
  if (frequency === "standard") return 2;
  if (frequency === "low") return 4;
  const textPageCount = Math.max(1, pages.filter((page) => page.role === "text").length);
  const sourceFigurePages = pages.filter((page) => (page.figures?.length ?? (page.figure ? 1 : 0)) > 0).length;
  const pageDensity = sourceFigurePages / textPageCount;
  const figureDensity = figureCount / textPageCount;
  if (figureDensity >= 0.48 || pageDensity >= 0.7) return 2;
  if (figureDensity >= 0.28 || pageDensity >= 0.34) return 3;
  return 4;
}

function buildSafeSinglePages(
  flow: FlowItem[],
  figurePool: PaperFigure[],
  sourcePage: PaperPage,
  placementInterval: number,
  frequency: FigureFrequency = "high",
  figureHeights: FigureHeightMap | undefined
): PaperPage[] {
  const queue = [...flow];
  const pages: PaperPage[] = [];
  let figureCursor = 0;

  while (queue.length > 0) {
    const figures = takeFiguresForPage(figurePool, figureCursor, pageFigureCount(frequency, pages.length, "single"), sourcePage.templateId);
    let textBudget = Math.max(
      180,
      SAFE_SINGLE_HEIGHT - figures.reduce((sum, figure) => sum + figureSlotHeight(figure, "single", figureHeights), 0)
    );
    if (figures.length > 0 && estimatedQueueTextHeight(queue, textBudget, "single") < MIN_TEXT_WITH_SINGLE_FIGURE * 0.45) {
      textBudget = Math.max(textBudget, SAFE_SINGLE_HEIGHT * 0.34);
    }
    const items = takeItemsForBudget(queue, textBudget, "single");
    if (items.length === 0) {
      items.push(forceTakeOneItem(queue, "single"));
    }
    figureCursor += figures.length;
    pages.push(buildSafeTextPage(sourcePage, pages.length, items, undefined, figures));
  }

  return pages;
}

function buildSafeDoublePages(
  flow: FlowItem[],
  figurePool: PaperFigure[],
  sourcePage: PaperPage,
  placementInterval: number,
  frequency: FigureFrequency = "high",
  figureHeights: FigureHeightMap | undefined
): PaperPage[] {
  const queue = [...flow];
  const pages: PaperPage[] = [];
  let figureCursor = 0;

  while (queue.length > 0) {
    const figures = takeFiguresForPage(figurePool, figureCursor, pageFigureCount(frequency, pages.length, "double"), sourcePage.templateId);
    const leftFigureHeight = figuresAtColumnPositions(figures, [0, 2]).reduce(
      (sum, figure) => sum + figureSlotHeight(figure, "double", figureHeights),
      0
    );
    const rightFigureHeight = figuresAtColumnPositions(figures, [1, 3]).reduce(
      (sum, figure) => sum + figureSlotHeight(figure, "double", figureHeights),
      0
    );
    const leftBudget = Math.max(150, SAFE_DOUBLE_COLUMN_HEIGHT - leftFigureHeight);
    const rightBudget = Math.max(150, SAFE_DOUBLE_COLUMN_HEIGHT - rightFigureHeight);
    const leftItems = takeItemsForBudget(queue, leftBudget, "double");
    if (leftItems.length === 0) {
      leftItems.push(forceTakeOneItem(queue, "double"));
    }
    const rightItems = takeItemsForBudget(queue, rightBudget, "double");
    if (rightItems.length === 0 && queue.length > 0) {
      rightItems.push(forceTakeOneItem(queue, "double"));
    }
    figureCursor += figures.length;

    const columns = [
      columnFromItems(leftItems),
      columnFromItems(rightItems)
    ];
    pages.push(buildSafeTextPage(
      sourcePage,
      pages.length,
      [...leftItems, ...rightItems],
      columns,
      figures
    ));
  }

  return pages;
}

function pageFigureCount(
  frequency: FigureFrequency,
  pageIndex: number,
  template: "single" | "double"
): number {
  const roll = stablePageRandom(pageIndex, template);
  if (template === "single") {
    if (frequency === "dense") return roll > 0.72 ? 2 : 1;
    if (frequency === "high") return roll > 0.78 ? 2 : roll > 0.2 ? 1 : 0;
    if (frequency === "standard") return roll > 0.48 ? 1 : 0;
    return roll > 0.78 ? 1 : 0;
  }
  if (frequency === "dense") return roll > 0.76 ? 3 : roll > 0.38 ? 2 : 1;
  if (frequency === "high") return roll > 0.68 ? 2 : roll > 0.18 ? 1 : 0;
  if (frequency === "standard") return roll > 0.52 ? 1 : 0;
  return roll > 0.82 ? 1 : 0;
}

function stablePageRandom(pageIndex: number, template: "single" | "double"): number {
  let hash = template === "double" ? 2166136261 : 16777619;
  hash ^= pageIndex + 1;
  hash = Math.imul(hash, 16777619);
  hash ^= (pageIndex + 11) * 2654435761;
  hash = Math.imul(hash, 2246822519);
  return (hash >>> 0) / 4294967295;
}

function takeFiguresForPage(
  figurePool: PaperFigure[],
  figureCursor: number,
  count: number,
  templateId: PaperPage["templateId"]
): PaperFigure[] {
  if (count <= 0 || figurePool.length === 0) return [];
  return Array.from({ length: count }).map((_, offset) =>
    normalizeFigureForTemplate(figureAtCursor(figurePool, figureCursor + offset), templateId)
  );
}

function figuresAtColumnPositions(figures: PaperFigure[], positions: number[]): PaperFigure[] {
  return positions
    .map((position) => figures[position])
    .filter((figure): figure is PaperFigure => Boolean(figure));
}

function figureAtCursor(figurePool: PaperFigure[], cursor: number): PaperFigure {
  const source = figurePool[cursor % figurePool.length];
  const cycle = Math.floor(cursor / figurePool.length);
  if (cycle === 0) {
    return {
      ...source,
      number: cursor + 1
    };
  }
  return {
    ...source,
    id: `${source.id}-cycle-${cycle}`,
    number: cursor + 1
  };
}

function normalizeFigureForTemplate(figure: PaperFigure, templateId: PaperPage["templateId"]): PaperFigure {
  if (figure.chartType === "formula") {
    return {
      ...figure,
      layout: templateId === "double-column-conference" ? "double_column_small" : "single_full_width"
    };
  }
  return {
    ...figure,
    layout: templateId === "double-column-conference" ? "double_column_small" : "single_full_width"
  };
}

function figureSlotHeight(
  figure: PaperFigure,
  template: "single" | "double",
  figureHeights: FigureHeightMap | undefined
): number {
  const measured = figureHeights?.[figure.id];
  if (measured && Number.isFinite(measured)) {
    const fallback = fallbackFigureSlotHeight(figure, template);
    const min = Math.max(template === "single" ? 160 : 136, fallback - 38);
    const max = Math.min(template === "single" ? 380 : 326, fallback + 46);
    return Math.ceil(clamp(measured, min, max));
  }
  return fallbackFigureSlotHeight(figure, template);
}

function fallbackFigureSlotHeight(figure: PaperFigure, template: "single" | "double"): number {
  const size = figureSize(figure);
  if (template === "single") {
    if (size === "compact") return 220;
    if (size === "tall") return 350;
    return 286;
  }
  if (size === "compact") return 176;
  if (size === "tall") return 306;
  return 246;
}

function figureSize(figure: PaperFigure): "compact" | "regular" | "tall" {
  const data = figure.data;
  if (figure.chartType === "formula") return "compact";
  if (figure.chartType === "plain_table" || figure.chartType === "table") return "tall";
  if (figure.chartType === "sankey" || figure.chartType === "graph" || figure.chartType === "network") return "tall";
  if (figure.chartType === "multi_panel" || figure.chartType === "flow") return "tall";
  if (figure.chartType === "candlestick" || figure.chartType === "gantt") return "tall";
  if (data?.kind === "series" && data.labels.length <= 5) return "compact";
  if (data?.kind === "ranked" && data.labels.length <= 5) return "compact";
  return "regular";
}

function buildSafeTextPage(
  sourcePage: PaperPage,
  localIndex: number,
  items: FlowItem[],
  columns?: PaperColumn[],
  figures: PaperFigure[] = [],
  figurePlacement?: PaperPage["figurePlacement"]
): PaperPage {
  const first = items[0];
  const sectionMarkers = markersFromItems(items);
  const sourceChapterMarkers = sourceChapterMarkersFromItems(items);
  return {
    ...sourcePage,
    id: `page-text-safe-${localIndex}`,
    index: localIndex,
    role: "text",
    sectionTitle: first?.sectionTitle ?? sourcePage.sectionTitle,
    sectionMarkers,
    sourceChapterMarkers,
    paragraphs: items.map((item) => item.text),
    columns,
    figure: figures[0],
    figures: figures.length > 0 ? figures : undefined,
    figurePlacement,
    figureLayout: figures[0]?.layout,
    sourceChapterId: first?.sourceChapterId ?? sourcePage.sourceChapterId,
    sourceProgress: first?.sourceProgress ?? sourcePage.sourceProgress,
    workScore: Math.min(0.98, Math.max(sourcePage.workScore, first?.workScore ?? 0.82))
  };
}

function columnFromItems(items: FlowItem[]): PaperColumn {
  return {
    paragraphs: items.map((item) => item.text),
    sectionMarkers: markersFromItems(items),
    sourceChapterMarkers: sourceChapterMarkersFromItems(items)
  };
}

function markersFromItems(items: ParagraphItem[]): PaperPage["sectionMarkers"] {
  return items.flatMap((item, paragraphIndex) =>
    item.marker
      ? [
          {
            paragraphIndex,
            title: item.marker
          }
        ]
      : []
  );
}

function sourceChapterMarkersFromItems(items: ParagraphItem[]): PaperPage["sourceChapterMarkers"] {
  return items.flatMap((item, paragraphIndex) =>
    item.sourceChapterMarker
      ? [
          {
            paragraphIndex,
            sourceChapterId: item.sourceChapterMarker.sourceChapterId,
            title: item.sourceChapterMarker.title
          }
        ]
      : []
  );
}

function takeItemsForBudget(
  queue: FlowItem[],
  budget: number,
  mode: "single" | "double"
): FlowItem[] {
  const items: FlowItem[] = [];
  let used = 0;

  while (queue.length > 0) {
    const item = queue[0];
    const itemHeight = estimateItemHeight(item, mode);
    const remaining = budget - used;

    if (itemHeight <= remaining) {
      items.push(item);
      queue.shift();
      used += itemHeight;
      continue;
    }

    const split = splitItemForHeight(item, remaining, mode);
    if (split) {
      items.push(split.head);
      queue[0] = split.tail;
    }
    break;
  }

  return items;
}

function estimatedQueueTextHeight(queue: FlowItem[], budget: number, mode: "single" | "double"): number {
  let used = 0;
  for (const item of queue) {
    const itemHeight = estimateItemHeight(item, mode);
    if (used + itemHeight > budget) {
      return used;
    }
    used += itemHeight;
  }
  return used;
}

function forceTakeOneItem(queue: FlowItem[], mode: "single" | "double"): FlowItem {
  const item = queue.shift();
  if (!item) {
    return {
      text: "",
      language: "zh",
      sourceProgress: 0,
      workScore: 0.82
    };
  }
  const itemHeight = estimateItemHeight(item, mode);
  const budget = mode === "single" ? SAFE_SINGLE_HEIGHT : SAFE_DOUBLE_COLUMN_HEIGHT;
  if (itemHeight <= budget) return item;
  const split = splitItemForHeight(item, budget, mode);
  if (!split) return item;
  queue.unshift(split.tail);
  return split.head;
}

function estimateItemHeight(item: ParagraphItem, mode: "single" | "double"): number {
  const text = item.text.trim();
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  const weightedLength = text.length + chineseChars * 0.18;
  const charsPerLine = mode === "double" ? 42 : 76;
  const lineHeight = mode === "double" ? 17.8 : 20.5;
  const lines = Math.max(1, Math.ceil(weightedLength / charsPerLine));
  const sectionHeight = item.marker || item.sourceChapterMarker ? 30 : 0;
  const paragraphGap = text.length > 90 ? 7 : 5;
  return Math.ceil(lines * lineHeight + paragraphGap + sectionHeight);
}

function splitItemForHeight(
  item: FlowItem,
  availableHeight: number,
  mode: "single" | "double"
): { head: FlowItem; tail: FlowItem } | null {
  const text = item.text.trim();
  if (text.length < SAFE_MIN_TEXT_SLICE * 2 || availableHeight < 48) return null;

  const fullHeight = estimateItemHeight(item, mode);
  const reservedMarkerHeight = item.marker || item.sourceChapterMarker ? 34 : 0;
  const ratio = clamp((availableHeight - reservedMarkerHeight - 10) / Math.max(1, fullHeight - reservedMarkerHeight), 0.18, 0.82);
  const splitIndex = findParagraphSplitIndex(text, Math.round(text.length * ratio));
  if (splitIndex < SAFE_MIN_TEXT_SLICE || text.length - splitIndex < SAFE_MIN_TEXT_SLICE) return null;

  const headText = text.slice(0, splitIndex).trim();
  const tailText = text.slice(splitIndex).trim();
  if (!headText || !tailText) return null;

  return {
    head: {
      ...item,
      text: headText
    },
    tail: {
      ...item,
      marker: undefined,
      sourceChapterMarker: undefined,
      text: tailText
    }
  };
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
    sourceChapterMarkers: [],
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
  if (page.columns?.length) {
    return {
      page,
      items: page.columns.flatMap((column) => {
        const markers = new Map(
          (column.sectionMarkers ?? []).map((marker) => [marker.paragraphIndex, marker.title])
        );
        const sourceChapterMarkers = new Map(
          (column.sourceChapterMarkers ?? []).map((marker) => [marker.paragraphIndex, marker])
        );
        return column.paragraphs.map((text, index) => ({
          marker: markers.get(index),
          sourceChapterMarker: sourceChapterMarkers.get(index),
          text
        }));
      })
    };
  }

  const markers = new Map(
    (page.sectionMarkers ?? []).map((marker) => [marker.paragraphIndex, marker.title])
  );
  const sourceChapterMarkers = new Map(
    (page.sourceChapterMarkers ?? []).map((marker) => [marker.paragraphIndex, marker])
  );
  return {
    page,
    items: (page.paragraphs ?? []).map((text, index) => ({
      marker: markers.get(index),
      sourceChapterMarker: sourceChapterMarkers.get(index),
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
    const contentHeight = measureRenderedContentHeight(content);
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

function measureRenderedContentHeight(content: HTMLElement): number {
  const contentRect = content.getBoundingClientRect();
  const candidates = Array.from(
    content.querySelectorAll<HTMLElement>(
      ".text-fragment, .figure-block, .inline-figures, .paper-flow-span"
    )
  );
  const bottom = candidates.reduce((max, node) => {
    const rect = node.getBoundingClientRect();
    if (rect.height <= 0) return max;
    return Math.max(max, rect.bottom - contentRect.top);
  }, 0);
  return Math.ceil(bottom);
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
            columns: undefined,
            sectionMarkers: markersFromItems(draft.items),
            sourceChapterMarkers: sourceChapterMarkersFromItems(draft.items)
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
  if (documentData.chapterAnchors.length === 0) {
    const seen = new Set<string>();
    return pages.flatMap((page) =>
      sourceChapterMarkersFromPage(page).map((marker) => {
        const id = marker.sourceChapterId ?? `${page.id}:${marker.title}`;
        if (seen.has(id)) return null;
        seen.add(id);
        return {
          id,
          title: marker.title,
          pageIndex: page.index,
          pageId: page.id
        };
      })
    ).filter((anchor): anchor is { id: string; title: string; pageIndex: number; pageId: string } => Boolean(anchor));
  }

  return documentData.chapterAnchors.map((anchor) => {
    const page = pages.find((candidate) => candidate.sourceChapterId === anchor.id) ?? pages[anchor.pageIndex];
    return {
      ...anchor,
      pageId: page?.id ?? anchor.pageId,
      pageIndex: page?.index ?? anchor.pageIndex
    };
  });
}

function sourceChapterMarkersFromPage(page: PaperPage): NonNullable<PaperPage["sourceChapterMarkers"]> {
  return [
    ...(page.sourceChapterMarkers ?? []),
    ...(page.columns ?? []).flatMap((column) => column.sourceChapterMarkers ?? [])
  ].filter((marker) => Boolean(marker.title));
}
