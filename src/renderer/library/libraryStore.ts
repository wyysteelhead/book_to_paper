import { create } from "zustand";
import type { ChartType, EnabledChartTypes, FigureFrequency, PaperDocument, PaperTemplateId, ParsedBook } from "../../common/types";
import { parseEpub } from "../import/parseEpub";
import { parseTxt } from "../import/parseTxt";
import { bookToPaper } from "../paper/bookToPaper";
import { computeBookStats } from "../paper/computeStats";

type ImportProgress = {
  message: string;
  percent: number;
  startedAt: number;
};

export type TypographySettings = {
  bodyFontFamily: string;
  bodyFontSize: number;
  bodyLineHeight: number;
  titleFontFamily: string;
  titleFontSize: number;
  titleFontWeight: number;
};

type LibraryState = {
  documents: PaperDocument[];
  activeDocument: PaperDocument | null;
  templateId: PaperTemplateId;
  isImporting: boolean;
  importStatus: ImportProgress | null;
  importError: string | null;
  useRealStats: boolean;
  statsTimeoutMs: number;
  figureFrequency: FigureFrequency;
  hidePageHeader: boolean;
  enabledChartTypes: Record<ChartType, boolean>;
  paperTitleTemplatesInput: string;
  sectionTitleTemplatesInput: string;
  typography: TypographySettings;
  pendingRedactionInput: string;
  documentRedactions: Record<string, string>;
  sourceBooks: Record<string, ParsedBook>;
  hydrateLibrary: () => Promise<void>;
  importBook: () => Promise<void>;
  openDocument: (document: PaperDocument) => void;
  removeDocument: (documentId: string) => void;
  closeDocument: () => void;
  setTemplateId: (templateId: PaperTemplateId) => void;
  setUseRealStats: (value: boolean) => void;
  setStatsTimeoutMs: (value: number) => void;
  setFigureFrequency: (value: FigureFrequency) => void;
  setHidePageHeader: (value: boolean) => void;
  setChartTypeEnabled: (type: ChartType, enabled: boolean) => void;
  setPaperTitleTemplatesInput: (value: string) => void;
  setSectionTitleTemplatesInput: (value: string) => void;
  setTypography: (settings: Partial<TypographySettings>) => void;
  setPendingRedactionInput: (value: string) => void;
  setDocumentRedactionInput: (bookId: string, value: string) => void;
  setActiveDocumentRedactionInput: (value: string) => void;
  refreshDocumentCharts: (documentId: string) => Promise<void>;
  refreshActiveDocumentCharts: () => Promise<void>;
  regenerateActiveDocument: (templateId: PaperTemplateId) => void;
};

const defaultSectionTitleTemplates = [
  "{n}.{m} 问题背景与文本结构",
  "{n}.{m} 局部信号与叙事密度",
  "{n}.{m} 主题复现的阶段性观察",
  "{n}.{m} 章节转移与语义线索",
  "{n}.{m} 案例片段的形式化分析",
  "{n}.{m} 讨论：隐含结构与阅读路径",
  "{n}.{m} 补充观察与稳健性检验"
];

const defaultPaperTitleTemplates = [
  "文本叙事结构与主题信号的重构分析：以《{title}》为研究对象",
  "面向隐含章节转移的文本结构分析：关于《{title}》的形式化观察",
  "{topic} 的局部密度与复现机制研究：基于《{title}》的重构证据",
  "A Structural Analysis of {title}: Evidence from {topic}",
  "Latent Narrative Signals and Section-Level Density in {title}",
  "Reconstructing Thematic Recurrence in {title}: A Document-Style Reading Study"
];

export const defaultEnabledChartTypes: Record<ChartType, boolean> = {
  bar: true,
  grouped_bar: true,
  stacked_bar: true,
  line: true,
  area: true,
  pie: true,
  scatter: true,
  matrix: true,
  gantt: true,
  candlestick: true,
  radar: true,
  word_cloud: true,
  heatmap: true,
  graph: true,
  sankey: true,
  network: true,
  table: true,
  plain_table: true,
  flow: true,
  multi_panel: true,
  formula: true
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  documents: [],
  activeDocument: null,
  templateId: "double-column-conference",
  isImporting: false,
  importStatus: null,
  importError: null,
  useRealStats: true,
  statsTimeoutMs: 2500,
  figureFrequency: "high",
  hidePageHeader: false,
  enabledChartTypes: defaultEnabledChartTypes,
  paperTitleTemplatesInput: defaultPaperTitleTemplates.join("\n"),
  sectionTitleTemplatesInput: defaultSectionTitleTemplates.join("\n"),
  typography: {
    bodyFontFamily: `"Times New Roman", "Songti SC", "SimSun", serif`,
    bodyFontSize: 12,
    bodyLineHeight: 1.46,
    titleFontFamily: `"Times New Roman", "Songti SC", "SimSun", serif`,
    titleFontSize: 15,
    titleFontWeight: 800
  },
  pendingRedactionInput: "",
  documentRedactions: {},
  sourceBooks: {},
  hydrateLibrary: async () => {
    const cached = await window.book2paper?.loadLibraryCache?.();
    if (!cached) return;
    set({
      documents: cached.documents ?? [],
      sourceBooks: cached.sourceBooks ?? {},
      documentRedactions: cached.documentRedactions ?? {},
      paperTitleTemplatesInput: cached.settings?.paperTitleTemplatesInput ?? defaultPaperTitleTemplates.join("\n"),
      sectionTitleTemplatesInput: cached.settings?.sectionTitleTemplatesInput ?? defaultSectionTitleTemplates.join("\n"),
      figureFrequency: cached.settings?.figureFrequency ?? "high",
      hidePageHeader: cached.settings?.hidePageHeader ?? false,
      enabledChartTypes: mergeEnabledChartTypes(cached.settings?.enabledChartTypes),
      templateId: cached.settings?.templateId ?? "double-column-conference"
    });
  },
  importBook: async () => {
    try {
      const startedAt = Date.now();
      const setProgress = (message: string, percent: number) =>
        set({ importStatus: { message, percent: Math.max(0, Math.min(99, percent)), startedAt } });

      set({ isImporting: true, importError: null });
      setProgress("正在打开文件选择器...", 2);

      if (!window.book2paper?.importBook) {
        set({
          isImporting: false,
          importStatus: null,
          importError:
            "本地导入 API 没有注入成功，请重启 Electron 开发窗口后再试。"
        });
        return;
      }

      const imported = await window.book2paper.importBook();
      if (!imported) {
        set({ isImporting: false, importStatus: null });
        return;
      }

      const sourceSize =
        imported.kind === "epub"
          ? Math.round((imported.dataBase64.length * 3) / 4)
          : imported.text.length;
      setProgress(
        `${imported.kind === "epub" ? "正在解析 EPUB" : "正在解析文本"}，约 ${formatSize(sourceSize)}...`,
        12
      );
      await yieldToUi();

      const parsed =
        imported.kind === "epub"
          ? await parseEpub(imported.fileName, imported.dataBase64)
          : parseTxt(imported.fileName, imported.text);
      const paragraphCount = parsed.chapters.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0);
      setProgress(`已解析 ${parsed.chapters.length} 个章节、${paragraphCount} 段正文。`, 32);
      await yieldToUi();

      const state = get();
      const languageProbe = `${parsed.title}\n${parsed.chapters
        .flatMap((chapter) => chapter.paragraphs)
        .join("\n")
        .slice(0, 2000)}`;
      const language = (languageProbe.match(/[\u4e00-\u9fa5]/g)?.length ?? 0) > languageProbe.length * 0.12 ? "zh" : "en";
      const stats = await computeBookStats(parsed, {
        enabled: state.useRealStats,
        timeoutMs: state.statsTimeoutMs,
        language,
        redactionTerms: parseRedactionTerms(state.pendingRedactionInput),
        onProgress: (message, percent) => setProgress(message, 34 + percent * 0.34)
      });

      setProgress("正在生成图表与论文分页...", 72);
      await yieldToUi();
      const document = bookToPaper(parsed, get().templateId, stats, {
        figureFrequency: get().figureFrequency,
        paperTitleTemplates: parseTemplateLines(get().paperTitleTemplatesInput),
        sectionTitleTemplates: parseSectionTitleTemplates(get().sectionTitleTemplatesInput),
        enabledChartTypes: enabledChartTypeList(get().enabledChartTypes)
      });
      setProgress(`已生成 ${document.pages.length} 页，正在打开阅读视图...`, 96);
      await yieldToUi();

      set((state) => ({
        documents: [document, ...state.documents],
        activeDocument: document,
        sourceBooks: { ...state.sourceBooks, [document.bookId]: parsed },
        documentRedactions: { ...state.documentRedactions, [document.bookId]: state.pendingRedactionInput },
        isImporting: false,
        importStatus: null,
        importError: null
      }));
      await persistLibraryCache(libraryCacheFromState(get()));
    } catch (error) {
      set({
        isImporting: false,
        importStatus: null,
        importError: error instanceof Error ? error.message : "导入失败，请换一本书试试。"
      });
    }
  },
  openDocument: (document) => set({ activeDocument: document }),
  removeDocument: (documentId) => {
    set((state) => ({
      documents: state.documents.filter((document) => document.id !== documentId),
      activeDocument: state.activeDocument?.id === documentId ? null : state.activeDocument,
      sourceBooks: Object.fromEntries(
        Object.entries(state.sourceBooks).filter(([bookId]) =>
          state.documents.some((document) => document.id !== documentId && document.bookId === bookId)
        )
      ),
      documentRedactions: Object.fromEntries(
        Object.entries(state.documentRedactions).filter(([bookId]) =>
          state.documents.some((document) => document.id !== documentId && document.bookId === bookId)
        )
      )
    }));
    void persistLibraryCache(libraryCacheFromState(get()));
  },
  closeDocument: () => set({ activeDocument: null }),
  setTemplateId: (templateId) => {
    set({ templateId });
    void persistLibraryCache(libraryCacheFromState(get()));
  },
  setUseRealStats: (value) => set({ useRealStats: value }),
  setStatsTimeoutMs: (value) => set({ statsTimeoutMs: value }),
  setFigureFrequency: (value) => {
    set({ figureFrequency: value });
    void persistLibraryCache(libraryCacheFromState(get()));
  },
  setHidePageHeader: (value) => {
    set({ hidePageHeader: value });
    void persistLibraryCache(libraryCacheFromState(get()));
  },
  setChartTypeEnabled: (type, enabled) => {
    set((state) => ({
      enabledChartTypes: {
        ...state.enabledChartTypes,
        [type]: enabled
      }
    }));
    void persistLibraryCache(libraryCacheFromState(get()));
  },
  setPaperTitleTemplatesInput: (value) => {
    set({ paperTitleTemplatesInput: value });
    void persistLibraryCache(libraryCacheFromState(get()));
  },
  setSectionTitleTemplatesInput: (value) => {
    set({ sectionTitleTemplatesInput: value });
    void persistLibraryCache(libraryCacheFromState(get()));
  },
  setTypography: (settings) =>
    set((state) => ({
      typography: {
        ...state.typography,
        ...settings
      }
    })),
  setPendingRedactionInput: (value) => set({ pendingRedactionInput: value }),
  setDocumentRedactionInput: (bookId, value) =>
    set((state) => ({
      documentRedactions: {
        ...state.documentRedactions,
        [bookId]: value
      }
    })),
  setActiveDocumentRedactionInput: (value) =>
    set((state) => {
      const active = state.activeDocument;
      if (!active) return { pendingRedactionInput: value };
      return {
        documentRedactions: {
          ...state.documentRedactions,
          [active.bookId]: value
        }
      };
    }),
  refreshDocumentCharts: async (documentId) => {
    const target = get().documents.find((document) => document.id === documentId);
    if (!target) return;
    const sourceBook = get().sourceBooks[target.bookId];
    if (!sourceBook) {
      set({ importError: "当前文档缺少原始导入缓存，请重新导入后再更新屏蔽词。" });
      return;
    }

    try {
      set({ isImporting: true, importError: null });
      const startedAt = Date.now();
      set({ importStatus: { message: "正在按屏蔽词重算统计图表...", percent: 20, startedAt } });
      const languageProbe = `${sourceBook.title}\n${sourceBook.chapters
        .flatMap((chapter) => chapter.paragraphs)
        .join("\n")
        .slice(0, 2000)}`;
      const language = (languageProbe.match(/[\u4e00-\u9fa5]/g)?.length ?? 0) > languageProbe.length * 0.12 ? "zh" : "en";
      const stats = await computeBookStats(sourceBook, {
        enabled: get().useRealStats,
        timeoutMs: get().statsTimeoutMs,
        language,
        redactionTerms: parseRedactionTerms(get().documentRedactions[target.bookId] ?? ""),
        onProgress: (message, percent) =>
          set({ importStatus: { message, percent: 20 + percent * 0.55, startedAt } })
      });
      set({ importStatus: { message: "正在刷新论文图表...", percent: 86, startedAt } });
      await yieldToUi();
      const refreshed = bookToPaper(sourceBook, target.templateId, stats, {
        figureFrequency: get().figureFrequency,
        paperTitleTemplates: parseTemplateLines(get().paperTitleTemplatesInput),
        sectionTitleTemplates: parseSectionTitleTemplates(get().sectionTitleTemplatesInput),
        enabledChartTypes: enabledChartTypeList(get().enabledChartTypes)
      });
      set((state) => ({
        activeDocument: state.activeDocument?.id === target.id ? refreshed : state.activeDocument,
        documents: state.documents.map((document) => (document.id === target.id ? refreshed : document)),
        isImporting: false,
        importStatus: null
      }));
      await persistLibraryCache(libraryCacheFromState(get()));
    } catch (error) {
      set({
        isImporting: false,
        importStatus: null,
        importError: error instanceof Error ? error.message : "更新屏蔽词失败，请重试。"
      });
    }
  },
  refreshActiveDocumentCharts: async () => {
    const active = get().activeDocument;
    if (!active) return;
    await get().refreshDocumentCharts(active.id);
  },
  regenerateActiveDocument: (templateId) => {
    const active = get().activeDocument;
    if (!active) {
      set({ templateId });
      return;
    }

    set((state) => {
      const original = state.documents.find((document) => document.bookId === active.bookId);
      if (!original) return { templateId };
      const fallbackBook = state.sourceBooks[active.bookId] ?? {
        id: active.bookId,
        title: active.sourceTitle,
        chapters: active.pages
          .filter((page) => page.role === "text" && page.paragraphs)
          .map((page, index) => ({
            id: page.sourceChapterId ?? `chapter-${index + 1}`,
            title: page.sectionTitle ?? `Section ${index + 1}`,
            paragraphs: page.paragraphs ?? []
          }))
      };
      const regenerated = bookToPaper(fallbackBook, templateId, active.stats, {
        figureFrequency: state.figureFrequency,
        paperTitleTemplates: parseTemplateLines(state.paperTitleTemplatesInput),
        sectionTitleTemplates: parseSectionTitleTemplates(state.sectionTitleTemplatesInput),
        enabledChartTypes: enabledChartTypeList(state.enabledChartTypes)
      });
      return {
        templateId,
        activeDocument: regenerated,
        documents: state.documents.map((document) =>
          document.id === active.id ? regenerated : document
        )
      };
    });
    void persistLibraryCache(libraryCacheFromState(get()));
  }
}));

type PersistableState = {
  documents: PaperDocument[];
  sourceBooks: Record<string, ParsedBook>;
  documentRedactions: Record<string, string>;
  paperTitleTemplatesInput: string;
  sectionTitleTemplatesInput: string;
  figureFrequency: FigureFrequency;
  hidePageHeader: boolean;
  enabledChartTypes: Record<ChartType, boolean>;
  templateId: PaperTemplateId;
};

function libraryCacheFromState(state: LibraryState): PersistableState {
  return {
    documents: state.documents,
    sourceBooks: state.sourceBooks,
    documentRedactions: state.documentRedactions,
    paperTitleTemplatesInput: state.paperTitleTemplatesInput,
    sectionTitleTemplatesInput: state.sectionTitleTemplatesInput,
    figureFrequency: state.figureFrequency,
    hidePageHeader: state.hidePageHeader,
    enabledChartTypes: state.enabledChartTypes,
    templateId: state.templateId
  };
}

async function persistLibraryCache(state: PersistableState): Promise<void> {
  await window.book2paper?.saveLibraryCache?.({
    documents: state.documents,
    sourceBooks: state.sourceBooks,
    documentRedactions: state.documentRedactions,
    settings: {
      paperTitleTemplatesInput: state.paperTitleTemplatesInput,
      sectionTitleTemplatesInput: state.sectionTitleTemplatesInput,
      figureFrequency: state.figureFrequency,
      hidePageHeader: state.hidePageHeader,
      enabledChartTypes: state.enabledChartTypes,
      templateId: state.templateId
    },
    savedAt: Date.now()
  });
}

function mergeEnabledChartTypes(cached: EnabledChartTypes | undefined): Record<ChartType, boolean> {
  return {
    ...defaultEnabledChartTypes,
    ...(cached ?? {})
  };
}

function enabledChartTypeList(types: Record<ChartType, boolean>): ChartType[] {
  return (Object.keys(types) as ChartType[]).filter((type) => types[type]);
}

function parseSectionTitleTemplates(input: string): string[] {
  return parseTemplateLines(input);
}

function parseTemplateLines(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRedactionTerms(input: string): string[] {
  return input
    .split(/[\n,，、;；\s]+/g)
    .map((term) => term.trim())
    .filter(Boolean);
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes > 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
