export type SourceType = "txt" | "epub" | "pdf" | "markdown";

export type PaperTemplateId =
  | "single-column-report"
  | "double-column-conference";

export type FigureFrequency = "low" | "standard" | "high" | "dense";
export type ChartType = PaperFigure["chartType"];
export type EnabledChartTypes = Partial<Record<ChartType, boolean>>;

export type FigureLayoutType =
  | "single_full_width"
  | "single_two_panel"
  | "single_three_panel"
  | "single_stacked"
  | "single_table_figure_mix"
  | "double_column_small"
  | "double_column_pair"
  | "double_span_teaser"
  | "double_span_figure"
  | "double_span_with_insets"
  | "double_grid_four"
  | "double_table_span";

export type PageRole =
  | "cover"
  | "abstract"
  | "teaser"
  | "text"
  | "figure"
  | "table"
  | "formula"
  | "references"
  | "appendix";

export type ImportedBookFile =
  | {
      kind: "text";
      fileName: string;
      sourcePath: string;
      text: string;
    }
  | {
      kind: "epub";
      fileName: string;
      sourcePath: string;
      dataBase64: string;
    };

export type Book = {
  id: string;
  title: string;
  author?: string;
  sourceType: SourceType;
  sourcePath: string;
  createdAt: number;
  updatedAt: number;
};

export type ParsedBook = {
  id: string;
  title: string;
  chapters: ParsedChapter[];
};

export type ParsedChapter = {
  id: string;
  title: string;
  paragraphs: string[];
};

export type PaperTemplate = {
  id: PaperTemplateId;
  name: string;
  columnMode: "single" | "double";
  pageSize: "a4" | "letter";
  defaultFigureLayouts: FigureLayoutType[];
  teaserLayout: FigureLayoutType;
};

export type PaperFigure = {
  id: string;
  number: number;
  layout: FigureLayoutType;
  title: string;
  caption: string;
  chartType:
	    | "bar"
	    | "grouped_bar"
	    | "stacked_bar"
	    | "line"
	    | "area"
	    | "pie"
	    | "scatter"
	    | "matrix"
	    | "gantt"
	    | "candlestick"
	    | "radar"
	    | "word_cloud"
	    | "heatmap"
	    | "graph"
	    | "sankey"
	    | "network"
	    | "table"
	    | "plain_table"
	    | "flow"
	    | "multi_panel"
	    | "formula"
	    | "custom";
  data?: PaperFigureData;
  customRenderer?: PaperFigureCustomRenderer;
  sourceChapterId?: string;
  workScoreBonus: number;
};

export type PaperFigureCustomRenderer = {
  language: "html";
  code: string;
};

export type PaperFigureData =
  | {
      kind: "ranked";
      labels: string[];
      values: number[];
    }
  | {
      kind: "series";
      labels: string[];
      values: number[];
    }
  | {
      kind: "table";
      headers: string[];
      rows: Array<Array<string | number>>;
    }
	  | {
	      kind: "network";
	      nodes: string[];
	      links: Array<[number, number, number]>;
	    }
	  | {
	      kind: "matrix";
	      labels: string[];
	      values: number[][];
	    }
	  | {
	      kind: "scatter";
	      points: Array<{ x: number; y: number; label?: string; size?: number }>;
	    }
	  | {
	      kind: "multi_series";
	      labels: string[];
	      series: Array<{ name: string; values: number[] }>;
	    }
	  | {
	      kind: "gantt";
	      tasks: Array<{ label: string; start: number; end: number; group?: string }>;
	    }
	  | {
	      kind: "candlestick";
	      labels: string[];
	      values: Array<{ open: number; high: number; low: number; close: number }>;
	    }
	  | {
	      kind: "sankey";
	      nodes: string[];
	      layers?: number[];
	      links: Array<{ source: number; target: number; value: number }>;
	    }
	  | {
	      kind: "flow";
	      nodes: string[];
	      links: Array<[number, number]>;
	      variant: "pipeline" | "decision" | "swimlane";
	    }
	  | {
	      kind: "custom";
	      props?: Record<string, string | number | boolean | Array<string | number>>;
	    };

export type PaperColumn = {
  paragraphs: string[];
  sectionMarkers?: Array<{
    paragraphIndex: number;
    title: string;
  }>;
  sourceChapterMarkers?: SourceChapterMarker[];
};

export type SourceChapterMarker = {
  paragraphIndex: number;
  sourceChapterId: string;
  title: string;
};

export type PaperColumnFigurePlacement = "left" | "right";

export type BookStats = {
  completed: boolean;
  elapsedMs: number;
  topTerms?: Array<{ term: string; count: number }>;
  chapterLengths?: Array<{ title: string; chars: number; paragraphs: number }>;
  paragraphExtremes?: {
    longest: Array<{ chapterTitle: string; length: number; preview: string }>;
    shortest: Array<{ chapterTitle: string; length: number; preview: string }>;
  };
  punctuationDensity?: Array<{ title: string; density: number }>;
  dialogueDensity?: Array<{ title: string; density: number }>;
  weirdMetrics?: Array<{ label: string; value: number | string }>;
};

export type DocumentLanguage = "zh" | "en";

export type PaperPage = {
  id: string;
  index: number;
  role: PageRole;
  templateId: PaperTemplateId;
  language: DocumentLanguage;
  title?: string;
  sectionTitle?: string;
  sectionMarkers?: Array<{
    paragraphIndex: number;
    title: string;
  }>;
  sourceChapterMarkers?: SourceChapterMarker[];
  paragraphs?: string[];
  columns?: PaperColumn[];
  figure?: PaperFigure;
  figures?: PaperFigure[];
  figurePlacement?: PaperColumnFigurePlacement;
  figureLayout?: FigureLayoutType;
  sourceChapterId?: string;
  sourceProgress: number;
  workScore: number;
};

export type PaperDocument = {
  id: string;
  bookId: string;
  templateId: PaperTemplateId;
  language: DocumentLanguage;
  sourceTitle: string;
  chapterAnchors: Array<{
    id: string;
    title: string;
    pageIndex: number;
    pageId: string;
  }>;
  title: string;
  abstract: string;
  keywords: string[];
  pages: PaperPage[];
  references: string[];
  stats?: BookStats;
  layoutCache?: {
    version: number;
    pages: PaperPage[];
    figureHeights: Record<string, number>;
    createdAt: number;
  };
  createdAt: number;
};

export type ReadingPosition = {
  pageIndex: number;
  scrollTop: number;
  updatedAt: number;
};

export type ReadingBookmark = {
  id: string;
  pageIndex: number;
  title: string;
  createdAt: number;
};

export type CustomChartTemplate = {
  id: string;
  name: string;
  enabled?: boolean;
  figure: PaperFigure;
  createdAt: number;
  updatedAt: number;
};

export type StoredLibraryData = {
  documents: PaperDocument[];
  sourceBooks: Record<string, ParsedBook>;
  documentRedactions: Record<string, string>;
  readingPositions?: Record<string, ReadingPosition>;
  readingBookmarks?: Record<string, ReadingBookmark[]>;
  customChartTemplates?: CustomChartTemplate[];
  settings?: {
    paperTitleTemplatesInput?: string;
    sectionTitleTemplatesInput?: string;
    figureFrequency?: FigureFrequency;
    hidePageHeader?: boolean;
    enabledChartTypes?: EnabledChartTypes;
    templateId?: PaperTemplateId;
  };
  savedAt: number;
};
