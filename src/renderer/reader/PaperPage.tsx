import type { CSSProperties } from "react";
import type { PaperFigure, PaperPage as PaperPageType } from "../../common/types";
import type { FigureHeightMap } from "./measuredPagination";
import { ChartRenderer } from "./charts/ChartRenderer";

type PaperPageProps = {
  page: PaperPageType;
  documentTitle: string;
  hidePageHeader?: boolean;
  figureHeights?: FigureHeightMap;
};

export function PaperPage({ page, documentTitle, hidePageHeader = false, figureHeights }: PaperPageProps): JSX.Element {
  const figures = page.figures ?? (page.figure ? [page.figure] : []);

  return (
    <article
      className={`paper-page paper-template-${page.templateId} role-${page.role} ${figures.length > 0 && page.role === "text" ? "has-inline-figure" : ""}`}
      data-page-id={page.id}
      data-page-index={page.index}
      data-page-role={page.role}
    >
      {hidePageHeader ? null : (
        <header className="paper-header">
          <span>{documentTitle}</span>
          <span>{page.sectionTitle ?? page.title ?? ""}</span>
          <span>{page.index + 1}</span>
        </header>
      )}

      {page.role === "cover" ? <CoverPage page={page} /> : null}
      {page.role === "abstract" ? <AbstractPage page={page} /> : null}
      {page.role === "text" ? <TextPage page={page} figures={figures} figureHeights={figureHeights} /> : null}
      {page.role !== "text" && figures.length > 0 ? <FigureGroup figures={figures} position="full" figureHeights={figureHeights} /> : null}
      {page.role === "formula" ? <FormulaPage page={page} /> : null}
      {page.role === "references" ? <ReferencesPage page={page} /> : null}

      <footer className="paper-footer">
        <span>{page.language === "zh" ? "文献结构分析草稿" : "Document Analysis Draft"}</span>
        <span>workScore {page.workScore.toFixed(2)}</span>
      </footer>
    </article>
  );
}

function CoverPage({ page }: { page: PaperPageType }): JSX.Element {
  return (
    <section className="cover-page">
      <p className="paper-kicker">{page.language === "zh" ? "工作论文" : "Working Paper"}</p>
      <h1>{page.title}</h1>
      <p className="author-line">
        {paperAuthorName(page)}
      </p>
      <div className="cover-meta">
        <span>{page.language === "zh" ? "预印本" : "Preprint"}</span>
        <span>{page.language === "zh" ? "本地生成" : "Generated locally"}</span>
        <span>Version 0.1</span>
      </div>
    </section>
  );
}

function paperAuthorName(page: PaperPageType): string {
  const zhAuthors = [
    "林知远",
    "陈砚秋",
    "周维宁",
    "许清和",
    "沈若川",
    "顾南舟",
    "陆景明",
    "韩闻溪"
  ];
  const enAuthors = [
    "Elena Marlow",
    "Julian Cross",
    "Nora Vale",
    "Adrian Finch",
    "Mira Sato",
    "Samuel Reed",
    "Clara Wynn",
    "Theo Morgan"
  ];
  const authors = page.language === "zh" ? zhAuthors : enAuthors;
  return authors[stableHash(`${page.title ?? ""}:${page.id}`) % authors.length];
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function AbstractPage({ page }: { page: PaperPageType }): JSX.Element {
  const [abstract, keywords] = page.paragraphs ?? [];

  return (
    <section className="paper-section abstract-section">
      <h2>{page.language === "zh" ? "摘要" : "Abstract"}</h2>
      <p>{abstract}</p>
      <p className="keywords">{keywords}</p>
    </section>
  );
}

function TextPage({
  page,
  figures,
  figureHeights
}: {
  page: PaperPageType;
  figures: PaperFigure[];
  figureHeights?: FigureHeightMap;
}): JSX.Element {
  const fragments = fragmentsFromParagraphs(page.id, page.paragraphs ?? [], page.sectionMarkers);
  const columns = page.columns?.map((column, columnIndex) =>
    fragmentsFromParagraphs(
      `${page.id}-column-${columnIndex}`,
      column.paragraphs,
      column.sectionMarkers
    )
  );

  if (page.templateId === "double-column-conference") {
    return <DoubleColumnTextPage page={page} fragments={fragments} figures={figures} columns={columns} figureHeights={figureHeights} />;
  }

  const { topFigures, bottomFigures } = splitSingleColumnFigures(figures);

  return (
    <section className="paper-section" data-page-content="text">
      {topFigures.length > 0 ? <FigureGroup figures={topFigures} position="top" figureHeights={figureHeights} /> : null}
      <div className="paper-body">
        {fragments.map(({ id, marker, paragraph }, index) => (
          <FragmentWithSection
            key={id}
            fragmentIndex={index}
            marker={marker}
            paragraph={paragraph}
          />
        ))}
      </div>
      {bottomFigures.length > 0 ? <FigureGroup figures={bottomFigures} position="bottom" figureHeights={figureHeights} /> : null}
    </section>
  );
}

type TextFragment = {
  id: string;
  marker?: string;
  paragraph: string;
};

function fragmentsFromParagraphs(
  idPrefix: string,
  paragraphs: string[],
  sectionMarkers?: PaperPageType["sectionMarkers"]
): TextFragment[] {
  const markers = new Map(
    (sectionMarkers ?? []).map((marker) => [marker.paragraphIndex, marker.title])
  );
  return paragraphs.map((paragraph, index) => ({
    id: `${idPrefix}-${index}`,
    marker: markers.get(index),
    paragraph
  }));
}

function DoubleColumnTextPage({
  page,
  fragments,
  figures,
  columns,
  figureHeights
}: {
  page: PaperPageType;
  fragments: TextFragment[];
  figures: PaperFigure[];
  columns?: TextFragment[][];
  figureHeights?: FigureHeightMap;
}): JSX.Element {
  const spanFigures = figures.filter(isSpanFigure);
  const columnFigures = figures.filter((figure) => !isSpanFigure(figure));
  const placedColumnFigures = columns && columnFigures.length === 1
    ? splitPlacedColumnFigures(columnFigures[0], page.figurePlacement)
    : {
        leftTop: columnFigures[0],
        rightBottom: columnFigures[1],
        leftBottom: columnFigures[2],
        rightTail: columnFigures[3]
      };
  const leftFigureLoad = figureColumnLoad([columnFigures[0], columnFigures[2]]);
  const rightFigureLoad = figureColumnLoad([columnFigures[1], columnFigures[3]]);
  const { leftFragments, rightFragments } = columns
    ? {
        leftFragments: columns[0] ?? [],
        rightFragments: columns[1] ?? []
      }
    : splitFragmentsForColumns(
        fragments,
        leftFigureLoad,
        rightFigureLoad
      );

  return (
    <section className="paper-section paper-flow-section" data-page-content="text">
      {spanFigures.slice(0, 1).map((figure) => (
        <div key={figure.id} className="paper-flow-span">
          <FigureBlock figure={figure} figureHeights={figureHeights} />
        </div>
      ))}
      <div className="paper-flow-grid" data-column-figure-count={columnFigures.length}>
        <div className="paper-flow-column">
          {placedColumnFigures.leftTop ? <FigureBlock figure={placedColumnFigures.leftTop} figureHeights={figureHeights} /> : null}
          <TextFragments fragments={leftFragments} />
          {placedColumnFigures.leftBottom ? <FigureBlock figure={placedColumnFigures.leftBottom} figureHeights={figureHeights} /> : null}
        </div>
        <div className="paper-flow-column">
          {placedColumnFigures.rightTop ? <FigureBlock figure={placedColumnFigures.rightTop} figureHeights={figureHeights} /> : null}
          <TextFragments fragments={rightFragments} />
          {placedColumnFigures.rightBottom ? <FigureBlock figure={placedColumnFigures.rightBottom} figureHeights={figureHeights} /> : null}
          {placedColumnFigures.rightTail ? <FigureBlock figure={placedColumnFigures.rightTail} figureHeights={figureHeights} /> : null}
        </div>
      </div>
      {spanFigures.slice(1).map((figure) => (
        <div key={figure.id} className="paper-flow-span paper-flow-span-late">
          <FigureBlock figure={figure} figureHeights={figureHeights} />
        </div>
      ))}
    </section>
  );
}

function splitPlacedColumnFigures(
  figure: PaperFigure,
  placement: PaperPageType["figurePlacement"]
): {
  leftTop?: PaperFigure;
  leftBottom?: PaperFigure;
  rightTop?: PaperFigure;
  rightBottom?: PaperFigure;
  rightTail?: PaperFigure;
} {
  return placement === "right"
    ? { rightTop: figure }
    : { leftTop: figure };
}

function TextFragments({ fragments }: { fragments: TextFragment[] }): JSX.Element {
  return (
    <>
      {fragments.map(({ id, marker, paragraph }, index) => (
        <FragmentWithSection key={id} fragmentIndex={index} marker={marker} paragraph={paragraph} />
      ))}
    </>
  );
}

function splitFragmentsForColumns(
  fragments: TextFragment[],
  leftFigureLoad: number,
  rightFigureLoad: number
): {
  leftFragments: TextFragment[];
  rightFragments: TextFragment[];
} {
  if (fragments.length <= 1) {
    return {
      leftFragments: fragments,
      rightFragments: []
    };
  }

  const heights = fragments.map(estimateDoubleColumnFragmentHeight);
  const totalHeight = heights.reduce((sum, height) => sum + height, 0);
  const targetRatio = clamp(0.5 - (leftFigureLoad - rightFigureLoad) * 0.08, 0.34, 0.62);
  const targetHeight = totalHeight * targetRatio;
  let runningHeight = 0;
  let splitIndex = 1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < fragments.length - 1; index += 1) {
    runningHeight += heights[index];
    const distance = Math.abs(runningHeight - targetHeight);
    if (distance <= bestDistance) {
      bestDistance = distance;
      splitIndex = index + 1;
    }
  }

  return {
    leftFragments: fragments.slice(0, splitIndex),
    rightFragments: fragments.slice(splitIndex)
  };
}

function estimateDoubleColumnFragmentHeight(fragment: TextFragment): number {
  const text = fragment.paragraph.trim();
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  const weightedLength = text.length + chineseChars * 0.55;
  const lines = Math.max(1, Math.ceil(weightedLength / 40));
  const paragraphGap = text.length > 90 ? 8 : 6;
  const markerHeight = fragment.marker ? 30 : 0;
  return lines * 17.6 + paragraphGap + markerHeight;
}

function figureColumnLoad(figures: Array<PaperFigure | undefined>): number {
  return figures.reduce((sum, figure) => {
    if (!figure) return sum;
    if (figure.chartType === "plain_table" || figure.chartType === "table") return sum + 1.25;
    if (figure.chartType === "flow" || figure.chartType === "multi_panel") return sum + 1.2;
    return sum + 1;
  }, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function splitSingleColumnFigures(figures: PaperFigure[]): {
  topFigures: PaperFigure[];
  bottomFigures: PaperFigure[];
} {
  if (figures.length <= 1) return { topFigures: figures, bottomFigures: [] };
  if (figures.length === 2) return { topFigures: [figures[0]], bottomFigures: [figures[1]] };
  return {
    topFigures: figures.slice(0, 2),
    bottomFigures: figures.slice(2)
  };
}

function isSpanFigure(figure: PaperFigure): boolean {
  return (
    figure.layout === "double_span_teaser" ||
    figure.layout === "double_span_figure" ||
    figure.layout === "double_span_with_insets" ||
    figure.layout === "double_table_span" ||
    figure.layout === "double_grid_four"
  );
}

function FragmentWithSection({
  fragmentIndex,
  marker,
  paragraph
}: {
  fragmentIndex: number;
  marker?: string;
  paragraph: string;
}): JSX.Element {
  const spacingClass = paragraphSpacingClass(paragraph);
  return (
    <div className="text-fragment" data-fragment-index={fragmentIndex}>
      {marker ? <h3 className="inline-section-title">{marker}</h3> : null}
      <p className={spacingClass}>{paragraph}</p>
    </div>
  );
}

function paragraphSpacingClass(paragraph: string): string {
  let hash = 0;
  for (let index = 0; index < paragraph.length; index += 1) {
    hash = (hash * 31 + paragraph.charCodeAt(index)) >>> 0;
  }
  if (hash % 11 === 0) return "paragraph-gap-large";
  if (hash % 5 === 0) return "paragraph-gap-medium";
  return "";
}

function FormulaPage({ page }: { page: PaperPageType }): JSX.Element {
  return (
    <section className="paper-section formula-section">
      <h2>{page.title}</h2>
      <div className="formula-box">
        <span>{page.language === "zh" ? "S(t) = αD(t) + βR(t) + γC(t)" : "S(t) = alpha D(t) + beta R(t) + gamma C(t)"}</span>
      </div>
      {(page.paragraphs ?? []).slice(1).map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  );
}

function ReferencesPage({ page }: { page: PaperPageType }): JSX.Element {
  return (
    <section className="paper-section references-section">
      <h2>{page.language === "zh" ? "参考文献" : "References"}</h2>
      {(page.paragraphs ?? []).map((reference) => (
        <p key={reference}>{reference}</p>
      ))}
    </section>
  );
}

function FigureGroup({
  figures,
  position,
  figureHeights
}: {
  figures: PaperFigure[];
  position: "top" | "bottom" | "full";
  figureHeights?: FigureHeightMap;
}): JSX.Element {
  return (
    <div className={`inline-figures figure-position-${position}`} data-figure-count={figures.length}>
      {figures.map((figure) => (
        <FigureBlock key={figure.id} figure={figure} figureHeights={figureHeights} />
      ))}
    </div>
  );
}

export function FigureBlock({
  figure,
  figureHeights
}: {
  figure: PaperFigure;
  figureHeights?: FigureHeightMap;
}): JSX.Element {
  const measuredHeight = figureHeights?.[figure.id];
  const slotHeight = measuredHeight ? measuredFigureSlotHeight(figure, measuredHeight) : null;
  const style = measuredHeight
    ? ({ "--figure-slot-height": `${slotHeight}px` } as CSSProperties)
    : undefined;
  return (
    <section
      className={`figure-block layout-${figure.layout} chart-${figure.chartType}`}
      data-chart-type={figure.chartType}
      data-figure-id={figure.id}
      data-figure-size={figureSize(figure)}
      data-layout={figure.layout}
      style={style}
    >
      <h2>{figure.title}</h2>
      <ChartRenderer figure={figure} />
      <p className="caption">{figure.caption}</p>
    </section>
  );
}

function measuredFigureSlotHeight(figure: PaperFigure, measuredHeight: number): number {
  const template = figure.layout === "single_full_width" ? "single" : "double";
  const fallback = fallbackFigureSlotHeight(figure, template);
  const min = Math.max(template === "single" ? 160 : 136, fallback - 38);
  const max = Math.min(template === "single" ? 380 : 326, fallback + 46);
  return Math.ceil(Math.min(max, Math.max(min, measuredHeight)));
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
