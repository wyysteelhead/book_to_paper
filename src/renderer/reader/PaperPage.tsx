import type { PaperFigure, PaperPage as PaperPageType } from "../../common/types";
import { ChartRenderer } from "./charts/ChartRenderer";

type PaperPageProps = {
  page: PaperPageType;
  documentTitle: string;
  hidePageHeader?: boolean;
};

export function PaperPage({ page, documentTitle, hidePageHeader = false }: PaperPageProps): JSX.Element {
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
      {page.role === "text" ? <TextPage page={page} figures={figures} /> : null}
      {page.role !== "text" && figures.length > 0 ? <FigureGroup figures={figures} position="full" /> : null}
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
        wyysteelhead
      </p>
      <div className="cover-meta">
        <span>{page.language === "zh" ? "预印本" : "Preprint"}</span>
        <span>{page.language === "zh" ? "本地生成" : "Generated locally"}</span>
        <span>Version 0.1</span>
      </div>
    </section>
  );
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

function TextPage({ page, figures }: { page: PaperPageType; figures: PaperFigure[] }): JSX.Element {
  const markers = new Map(
    (page.sectionMarkers ?? []).map((marker) => [marker.paragraphIndex, marker.title])
  );
  const fragments = (page.paragraphs ?? []).map((paragraph, index) => ({
    id: `${page.id}-${index}`,
    marker: markers.get(index),
    paragraph
  }));

  if (page.templateId === "double-column-conference" && figures.length > 0) {
    return <DoubleColumnTextPage page={page} fragments={fragments} figures={figures} />;
  }

  const { topFigures, bottomFigures } = splitSingleColumnFigures(figures);

  return (
    <section className="paper-section" data-page-content="text">
      {topFigures.length > 0 ? <FigureGroup figures={topFigures} position="top" /> : null}
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
      {bottomFigures.length > 0 ? <FigureGroup figures={bottomFigures} position="bottom" /> : null}
    </section>
  );
}

type TextFragment = {
  id: string;
  marker?: string;
  paragraph: string;
};

function DoubleColumnTextPage({
  page,
  fragments,
  figures
}: {
  page: PaperPageType;
  fragments: TextFragment[];
  figures: PaperFigure[];
}): JSX.Element {
  const spanFigures = figures.filter(isSpanFigure);
  const columnFigures = figures.filter((figure) => !isSpanFigure(figure));
  const leftFigureLoad = figureColumnLoad([columnFigures[0], columnFigures[2]]);
  const rightFigureLoad = figureColumnLoad([columnFigures[1], columnFigures[3]]);
  const { leftFragments, rightFragments } = splitFragmentsForColumns(
    fragments,
    leftFigureLoad,
    rightFigureLoad
  );

  return (
    <section className="paper-section paper-flow-section" data-page-content="text">
      {spanFigures.slice(0, 1).map((figure) => (
        <div key={figure.id} className="paper-flow-span">
          <FigureBlock figure={figure} />
        </div>
      ))}
      <div className="paper-flow-grid" data-column-figure-count={columnFigures.length}>
        <div className="paper-flow-column">
          {columnFigures[0] ? <FigureBlock figure={columnFigures[0]} /> : null}
          <TextFragments fragments={leftFragments} />
          {columnFigures[2] ? <FigureBlock figure={columnFigures[2]} /> : null}
        </div>
        <div className="paper-flow-column">
          <TextFragments fragments={rightFragments} />
          {columnFigures[1] ? <FigureBlock figure={columnFigures[1]} /> : null}
          {columnFigures[3] ? <FigureBlock figure={columnFigures[3]} /> : null}
        </div>
      </div>
      {spanFigures.slice(1).map((figure) => (
        <div key={figure.id} className="paper-flow-span paper-flow-span-late">
          <FigureBlock figure={figure} />
        </div>
      ))}
    </section>
  );
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
  const totalLength = fragments.reduce((sum, fragment) => sum + fragment.paragraph.length, 0);
  const targetRatio = clamp(0.5 - (leftFigureLoad - rightFigureLoad) * 0.08, 0.34, 0.62);
  const targetLength = totalLength * targetRatio;
  let runningLength = 0;
  let splitIndex = Math.max(1, Math.ceil(fragments.length / 2));

  for (let index = 0; index < fragments.length; index += 1) {
    runningLength += fragments[index].paragraph.length;
    if (runningLength >= targetLength) {
      splitIndex = Math.min(Math.max(index + 1, 1), Math.max(fragments.length - 1, 1));
      break;
    }
  }

  return {
    leftFragments: fragments.slice(0, splitIndex),
    rightFragments: fragments.slice(splitIndex)
  };
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
  position
}: {
  figures: PaperFigure[];
  position: "top" | "bottom" | "full";
}): JSX.Element {
  return (
    <div className={`inline-figures figure-position-${position}`} data-figure-count={figures.length}>
      {figures.map((figure) => (
        <FigureBlock key={figure.id} figure={figure} />
      ))}
    </div>
  );
}

function FigureBlock({ figure }: { figure: PaperFigure }): JSX.Element {
  return (
    <section
      className={`figure-block layout-${figure.layout} chart-${figure.chartType}`}
      data-chart-type={figure.chartType}
      data-figure-id={figure.id}
      data-layout={figure.layout}
    >
      <h2>{figure.title}</h2>
      <ChartRenderer figure={figure} />
      <p className="caption">{figure.caption}</p>
    </section>
  );
}
