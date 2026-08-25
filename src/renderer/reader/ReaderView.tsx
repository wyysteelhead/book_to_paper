import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type Ref } from "react";
import { ArrowLeft, Bookmark, Bot, Download, ListTree, RotateCcw, Shield, Trash2, X } from "lucide-react";
import type { PaperDocument, PaperFigure, PaperTemplateId, ReadingBookmark } from "../../common/types";
import { useLibraryStore } from "../library/libraryStore";
import { paperTemplates } from "../paper/templates";
import { FigureBlock, PaperPage } from "./PaperPage";
import { selectAcademicTarget } from "./scrollController";
import { useReaderStore } from "./readerStore";
import {
  type FigureHeightMap,
  repaginateDocumentFromPage,
  repaginateDocumentSafely
} from "./measuredPagination";
import { RedactionTermEditor } from "../library/RedactionTermEditor";

type ReaderViewProps = {
  document: PaperDocument;
};

const PAGE_RENDER_BUFFER = 4;
const PAGE_STEP = 1084;
const LAYOUT_CACHE_VERSION = 3;

type PageContextMenu = {
  pageIndex: number;
  x: number;
  y: number;
};

export function ReaderView({ document }: ReaderViewProps): JSX.Element {
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [redactionOpen, setRedactionOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pageContextMenu, setPageContextMenu] = useState<PageContextMenu | null>(null);
  const [reflowConfirmPageIndex, setReflowConfirmPageIndex] = useState<number | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [layoutDocument, setLayoutDocument] = useState(() => cachedLayoutDocument(document) ?? document);
  const [figureHeights, setFigureHeights] = useState<FigureHeightMap>(() => document.layoutCache?.figureHeights ?? {});
  const [isMeasuringFigures, setIsMeasuringFigures] = useState(() => !cachedLayoutDocument(document) && collectMeasuredFigures(document).length > 0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [renderAllPages, setRenderAllPages] = useState(false);
  const lastSavedPositionAt = useRef(0);
  const currentPageIndexRef = useRef(0);
  const hasRestoredInitialPosition = useRef(false);
  const paperStackRef = useRef<HTMLDivElement | null>(null);
  const figureMeasureRef = useRef<HTMLDivElement | null>(null);
  const bookmarkCloseTimer = useRef<number | null>(null);
  const closeDocument = useLibraryStore((state) => state.closeDocument);
  const regenerateActiveDocument = useLibraryStore((state) => state.regenerateActiveDocument);
  const documentRedactions = useLibraryStore((state) => state.documentRedactions);
  const isImporting = useLibraryStore((state) => state.isImporting);
  const setDocumentRedactionInput = useLibraryStore((state) => state.setDocumentRedactionInput);
  const refreshDocumentCharts = useLibraryStore((state) => state.refreshDocumentCharts);
  const autoHideToolbar = useLibraryStore((state) => state.hidePageHeader);
  const figureFrequency = useLibraryStore((state) => state.figureFrequency);
  const readingPositions = useLibraryStore((state) => state.readingPositions);
  const readingBookmarks = useLibraryStore((state) => state.readingBookmarks);
  const saveReadingPosition = useLibraryStore((state) => state.saveReadingPosition);
  const saveDocumentLayoutCache = useLibraryStore((state) => state.saveDocumentLayoutCache);
  const addReadingBookmark = useLibraryStore((state) => state.addReadingBookmark);
  const removeReadingBookmark = useLibraryStore((state) => state.removeReadingBookmark);
  const replaceReadingBookmarks = useLibraryStore((state) => state.replaceReadingBookmarks);
  const savedPosition = useReaderStore((state) => state.savedPosition);
  const restoreAvailable = useReaderStore((state) => state.restoreAvailable);
  const savePosition = useReaderStore((state) => state.savePosition);
  const setRestoreAvailable = useReaderStore((state) => state.setRestoreAvailable);
  const visibleDocument = layoutDocument;
  const bookmarks = readingBookmarks[visibleDocument.id] ?? [];
  const currentPageBookmark = bookmarks.find((bookmark) => bookmark.pageIndex === currentPageIndex) ?? null;
  const renderedPageStart = renderAllPages ? 0 : Math.max(0, currentPageIndex - PAGE_RENDER_BUFFER);
  const renderedPageEnd = renderAllPages
    ? visibleDocument.pages.length
    : Math.min(visibleDocument.pages.length, currentPageIndex + PAGE_RENDER_BUFFER + 1);
  const renderedPages = visibleDocument.pages.slice(renderedPageStart, renderedPageEnd);
  const topSpacerHeight = renderedPageStart > 0 ? renderedPageStart * PAGE_STEP - 28 : 0;
  const bottomSpacerPageCount = Math.max(0, visibleDocument.pages.length - renderedPageEnd);
  const bottomSpacerHeight = bottomSpacerPageCount > 0 ? bottomSpacerPageCount * PAGE_STEP - 28 : 0;

  currentPageIndexRef.current = currentPageIndex;

  const openBookmarks = (): void => {
    if (bookmarkCloseTimer.current) {
      window.clearTimeout(bookmarkCloseTimer.current);
      bookmarkCloseTimer.current = null;
    }
    setBookmarksOpen(true);
  };

  const scheduleCloseBookmarks = (): void => {
    if (bookmarkCloseTimer.current) window.clearTimeout(bookmarkCloseTimer.current);
    bookmarkCloseTimer.current = window.setTimeout(() => {
      setBookmarksOpen(false);
      bookmarkCloseTimer.current = null;
    }, 120);
  };

  useLayoutEffect(() => {
    lastSavedPositionAt.current = 0;
    hasRestoredInitialPosition.current = false;
    const cached = cachedLayoutDocument(document);
    if (cached) {
      setFigureHeights(document.layoutCache?.figureHeights ?? {});
      setIsMeasuringFigures(false);
      setLayoutDocument(cached);
    } else {
      setFigureHeights({});
      const hasFigures = collectMeasuredFigures(document).length > 0;
      setIsMeasuringFigures(hasFigures);
      setLayoutDocument(document);
      if (!hasFigures) {
        saveDocumentLayoutCache(document.id, {
          version: LAYOUT_CACHE_VERSION,
          pages: document.pages,
          figureHeights: {},
          createdAt: Date.now()
        });
      }
    }
    const restoredIndex = readingPositions[document.id]?.pageIndex ?? 0;
    currentPageIndexRef.current = restoredIndex;
    setCurrentPageIndex(restoredIndex);
  }, [document]);

  useLayoutEffect(() => {
    if (!isMeasuringFigures) return;
    const host = figureMeasureRef.current;
    if (!host) return;
    const nextHeights: FigureHeightMap = {};
    const nodes = Array.from(host.querySelectorAll<HTMLElement>("[data-figure-id]"));
    for (const node of nodes) {
      const id = node.dataset.figureId;
      if (!id) continue;
      const height = Math.ceil(Math.max(node.scrollHeight, node.getBoundingClientRect().height));
      if (height > 0) nextHeights[id] = height;
    }
    if (Object.keys(nextHeights).length === 0) {
      setIsMeasuringFigures(false);
      return;
    }
    setFigureHeights(nextHeights);
    const nextDocument = repaginateDocumentSafely(document, {
      figureFrequency,
      figureHeights: nextHeights
    });
    setLayoutDocument(nextDocument);
    saveDocumentLayoutCache(document.id, {
      version: LAYOUT_CACHE_VERSION,
      pages: nextDocument.pages,
      figureHeights: nextHeights,
      createdAt: Date.now()
    });
    setIsMeasuringFigures(false);
  }, [document, figureFrequency, isMeasuringFigures, saveDocumentLayoutCache]);

  useLayoutEffect(() => {
    if (hasRestoredInitialPosition.current) return;
    const saved = readingPositions[document.id];
    if (!saved) {
      hasRestoredInitialPosition.current = true;
      return;
    }

    const pageIndex = Math.max(0, Math.min(visibleDocument.pages.length - 1, saved.pageIndex));
    if (currentPageIndex !== pageIndex) {
      setCurrentPageIndex(pageIndex);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const page = visibleDocument.pages[pageIndex];
      const node = page
        ? window.document.querySelector<HTMLElement>(`[data-page-id="${page.id}"]`)
        : null;
      if (node) {
        node.scrollIntoView({ behavior: "auto", block: "center" });
      } else {
        window.scrollTo({ top: saved.scrollTop, behavior: "auto" });
      }
      hasRestoredInitialPosition.current = true;
      lastSavedPositionAt.current = Date.now();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentPageIndex, document.id, readingPositions, visibleDocument.pages]);

  useEffect(() => {
    if (renderAllPages) return;

    const updateCurrentPage = () => {
      if (!hasRestoredInitialPosition.current) return;
      const stackTop = paperStackRef.current?.getBoundingClientRect().top ?? 0;
      const absoluteStackTop = window.scrollY + stackTop;
      const nextIndex = Math.max(
        0,
        Math.min(
          visibleDocument.pages.length - 1,
          Math.round((window.scrollY - absoluteStackTop + window.innerHeight * 0.45) / PAGE_STEP)
        )
      );
      if (nextIndex !== currentPageIndexRef.current) {
        currentPageIndexRef.current = nextIndex;
        setCurrentPageIndex(nextIndex);
      }
      if (Date.now() - lastSavedPositionAt.current > 1200) {
        lastSavedPositionAt.current = Date.now();
        saveReadingPosition(visibleDocument.id, {
          pageIndex: nextIndex,
          scrollTop: window.scrollY,
          updatedAt: Date.now()
        });
      }
    };

    updateCurrentPage();
    window.addEventListener("scroll", updateCurrentPage, { passive: true });
    window.addEventListener("resize", updateCurrentPage);
    return () => {
      window.removeEventListener("scroll", updateCurrentPage);
      window.removeEventListener("resize", updateCurrentPage);
    };
  }, [renderAllPages, saveReadingPosition, visibleDocument.id, visibleDocument.pages.length]);

  useEffect(() => {
    if (!autoHideToolbar) {
      setToolbarVisible(true);
      return;
    }

    setToolbarVisible(true);
    const updateToolbarVisibility = () => {
      setToolbarVisible(window.scrollY < 96);
    };

    window.addEventListener("scroll", updateToolbarVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateToolbarVisibility);
  }, [autoHideToolbar, visibleDocument.id]);

  useEffect(() => {
    return () => {
      if (bookmarkCloseTimer.current) window.clearTimeout(bookmarkCloseTimer.current);
      if (!hasRestoredInitialPosition.current) return;
      saveReadingPosition(visibleDocument.id, {
        pageIndex: currentPageIndex,
        scrollTop: window.scrollY,
        updatedAt: Date.now()
      });
    };
  }, [currentPageIndex, saveReadingPosition, visibleDocument.id]);

  useEffect(() => {
    if (!pageContextMenu) return;

    const closeMenu = () => setPageContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, { passive: true });
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [pageContextMenu]);

  const simulateVisitor = (): void => {
    savePosition({
      pageIndex: currentPageIndex,
      scrollTop: window.scrollY,
      updatedAt: Date.now()
    });
    const target = selectAcademicTarget(visibleDocument, currentPageIndex);
    scrollToPageIndex(target.index);
    window.setTimeout(() => setRestoreAvailable(true), 1800);
  };

  const restorePosition = (): void => {
    if (!savedPosition) return;
    window.scrollTo({ top: savedPosition.scrollTop, behavior: "smooth" });
    setRestoreAvailable(false);
  };

  const createBookmark = (): void => {
    if (currentPageBookmark) {
      setBookmarksOpen(true);
      return;
    }
    const page = visibleDocument.pages[currentPageIndex];
    addReadingBookmark(visibleDocument.id, {
      id: `bookmark-${Date.now()}`,
      pageIndex: currentPageIndex,
      title: page?.sectionTitle ?? page?.title ?? `${visibleDocument.language === "zh" ? "第" : "Page"} ${currentPageIndex + 1}`,
      createdAt: Date.now()
    });
  };

  const exportPdf = async (): Promise<void> => {
    if (!window.book2paper?.exportPdf || isExporting) return;
    try {
      setIsExporting(true);
      setRenderAllPages(true);
      setExportStatus("正在生成 PDF...");
      await waitForPaint();
      await waitForPaint();
      const filePath = await window.book2paper.exportPdf(visibleDocument.title);
      setExportStatus(filePath ? `已导出：${filePath}` : null);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "导出失败，请重试。");
    } finally {
      setRenderAllPages(false);
      setIsExporting(false);
    }
  };

  const openPageContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
    const pageNode = (event.target as HTMLElement | null)?.closest<HTMLElement>(".paper-page[data-page-index]");
    if (!pageNode || !paperStackRef.current?.contains(pageNode)) return;
    const pageIndex = Number(pageNode.dataset.pageIndex);
    if (!Number.isInteger(pageIndex)) return;
    event.preventDefault();
    setPageContextMenu({
      pageIndex,
      x: event.clientX,
      y: event.clientY
    });
  };

  const confirmReflowFromPage = (): void => {
    if (!pageContextMenu) return;
    setReflowConfirmPageIndex(pageContextMenu.pageIndex);
    setPageContextMenu(null);
  };

  const reflowFromPage = (pageIndex: number): void => {
    const repairedBookmarks = remapBookmarksAfterReflow(bookmarks, visibleDocument, pageIndex);
    const nextDocument = repaginateDocumentFromPage(visibleDocument, pageIndex, {
      figureFrequency,
      figureHeights
    });
    const nextBookmarks = repairedBookmarks(nextDocument);
    setLayoutDocument(nextDocument);
    saveDocumentLayoutCache(nextDocument.id, {
      version: LAYOUT_CACHE_VERSION,
      pages: nextDocument.pages,
      figureHeights,
      createdAt: Date.now()
    });
    replaceReadingBookmarks(nextDocument.id, nextBookmarks);
    const nextPageIndex = Math.max(0, Math.min(nextDocument.pages.length - 1, pageIndex));
    currentPageIndexRef.current = nextPageIndex;
    setCurrentPageIndex(nextPageIndex);
    setReflowConfirmPageIndex(null);
    window.requestAnimationFrame(() => {
      const page = nextDocument.pages[nextPageIndex];
      const node = page
        ? window.document.querySelector<HTMLElement>(`[data-page-id="${page.id}"]`)
        : null;
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const stackTop = paperStackRef.current?.getBoundingClientRect().top ?? 0;
      const absoluteStackTop = window.scrollY + stackTop;
      window.scrollTo({ top: absoluteStackTop + nextPageIndex * PAGE_STEP, behavior: "smooth" });
    });
  };

  const scrollToPageIndex = (pageIndex: number): void => {
    const page = visibleDocument.pages[pageIndex];
    if (!page) return;
    currentPageIndexRef.current = pageIndex;
    setCurrentPageIndex(pageIndex);
    window.requestAnimationFrame(() => {
      const node = window.document.querySelector<HTMLElement>(`[data-page-id="${page.id}"]`);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const stackTop = paperStackRef.current?.getBoundingClientRect().top ?? 0;
      const absoluteStackTop = window.scrollY + stackTop;
      window.scrollTo({ top: absoluteStackTop + pageIndex * PAGE_STEP, behavior: "smooth" });
    });
  };

  return (
    <section className={`reader-view ${autoHideToolbar ? "toolbar-auto-hide" : ""}`}>
      {autoHideToolbar ? (
        <div
          className="reader-toolbar-hover-zone"
          onMouseEnter={() => setToolbarVisible(true)}
          aria-hidden="true"
        />
      ) : null}
      <header
        className={`reader-toolbar ${autoHideToolbar && !toolbarVisible ? "hidden" : ""}`}
        onMouseEnter={() => {
          if (autoHideToolbar) setToolbarVisible(true);
        }}
      >
        <button className="icon-button" onClick={closeDocument} aria-label="返回书库">
          <ArrowLeft size={18} />
        </button>
        <div className="reader-title">
          <strong>{visibleDocument.title}</strong>
          <small>
            {paperTemplates[visibleDocument.templateId].name} · {visibleDocument.pages.length} pages
          </small>
        </div>
        <div className="toolbar-spacer" />
        <button
          className="icon-button subtle"
          onClick={() => setChaptersOpen((open) => !open)}
          aria-label="章节导航"
          title="章节导航"
        >
          <ListTree size={17} />
        </button>
        <div
          className="bookmark-toolbar-popover"
          onMouseEnter={openBookmarks}
          onMouseLeave={scheduleCloseBookmarks}
          onFocus={openBookmarks}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) scheduleCloseBookmarks();
          }}
        >
          <button
            className={`icon-button subtle bookmark-action ${currentPageBookmark ? "active" : ""}`}
            onClick={createBookmark}
            aria-label={currentPageBookmark ? "当前页已添加书签" : "添加书签"}
            title={currentPageBookmark ? "当前页已添加书签" : "添加书签"}
            aria-disabled={Boolean(currentPageBookmark)}
          >
            <Bookmark size={17} fill={currentPageBookmark ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="template-picker compact">
          {(Object.keys(paperTemplates) as PaperTemplateId[]).map((id) => (
            <button
              key={id}
              className={visibleDocument.templateId === id ? "segmented active" : "segmented"}
              onClick={() => regenerateActiveDocument(id)}
            >
              {paperTemplates[id].name}
            </button>
          ))}
        </div>
        <button
          className="icon-button subtle"
          onClick={simulateVisitor}
          aria-label="模拟多人出现"
          title="模拟多人出现"
        >
          <Bot size={17} />
        </button>
        <button
          className="icon-button subtle"
          onClick={() => setRedactionOpen(true)}
          aria-label="屏蔽词"
          title="屏蔽词"
        >
          <Shield size={17} />
        </button>
        <button
          className="icon-button subtle"
          onClick={exportPdf}
          disabled={isExporting}
          aria-label={isExporting ? "正在导出 PDF" : "导出 PDF"}
          title={isExporting ? "正在导出 PDF" : "导出 PDF"}
        >
          <Download size={17} />
        </button>
        {restoreAvailable ? (
          <button className="icon-button subtle" onClick={restorePosition} aria-label="回到原位置" title="回到原位置">
            <RotateCcw size={17} />
          </button>
        ) : null}
      </header>

      {exportStatus ? <div className="export-status">{exportStatus}</div> : null}

      {isMeasuringFigures ? <LayoutProgress /> : null}

      <div
        className={`paper-stack ${isMeasuringFigures ? "layout-measuring" : ""}`}
        ref={paperStackRef}
        onContextMenu={openPageContextMenu}
      >
        {topSpacerHeight > 0 ? (
          <div className="paper-stack-spacer" style={{ height: topSpacerHeight }} aria-hidden="true" />
        ) : null}
        {renderedPages.map((page) => (
          <PaperPage
            key={page.id}
              page={page}
              documentTitle={visibleDocument.title}
              hidePageHeader={false}
              figureHeights={figureHeights}
            />
        ))}
        {bottomSpacerHeight > 0 ? (
          <div className="paper-stack-spacer" style={{ height: bottomSpacerHeight }} aria-hidden="true" />
        ) : null}
      </div>

      <ChartMeasureHost documentData={visibleDocument} measureRef={figureMeasureRef} />

      {pageContextMenu ? (
        <div
          className="page-context-menu"
          style={{
            left: pageContextMenu.x,
            top: pageContextMenu.y
          }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={confirmReflowFromPage} role="menuitem">
            渲染异常，从此页重排
          </button>
        </div>
      ) : null}

      {reflowConfirmPageIndex !== null ? (
        <div className="import-overlay" role="presentation" onMouseDown={() => setReflowConfirmPageIndex(null)}>
          <section className="reflow-confirm-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Layout Repair</p>
                <h2>从第 {reflowConfirmPageIndex + 1} 页之后重新分页？</h2>
              </div>
              <button className="icon-button subtle" onClick={() => setReflowConfirmPageIndex(null)}>
                <X size={18} />
              </button>
            </header>
            <p>
              这会保留前面的页面，从当前页开始重新计算正文和图表位置。文章比较长时可能会稍慢。
            </p>
            <div className="redaction-actions">
              <button className="secondary-button" onClick={() => setReflowConfirmPageIndex(null)}>
                取消
              </button>
              <button className="primary-button" onClick={() => reflowFromPage(reflowConfirmPageIndex)}>
                现在重新分页
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {chaptersOpen ? (
        <aside className="chapter-drawer">
          <header>
            <strong>{visibleDocument.language === "zh" ? "原书章节" : "Source Chapters"}</strong>
            <button className="chapter-close" onClick={() => setChaptersOpen(false)}>
              ×
            </button>
          </header>
          <div className="chapter-list">
            {visibleDocument.chapterAnchors.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => {
                  setChaptersOpen(false);
                  scrollToPageIndex(chapter.pageIndex);
                }}
              >
                <span>{chapter.title}</span>
                <small>p. {chapter.pageIndex + 1}</small>
              </button>
            ))}
          </div>
        </aside>
      ) : null}

      {bookmarksOpen ? (
        <aside
          className="chapter-drawer bookmark-drawer"
          onMouseEnter={openBookmarks}
          onMouseLeave={scheduleCloseBookmarks}
        >
          <header>
            <strong>{visibleDocument.language === "zh" ? "阅读书签" : "Bookmarks"}</strong>
            <button className="chapter-close" onClick={() => setBookmarksOpen(false)}>
              ×
            </button>
          </header>
          <div className="chapter-list">
            {bookmarks.length === 0 ? (
              <p className="empty-bookmarks">暂无书签，点击工具栏书签按钮保存当前页。</p>
            ) : (
              bookmarks.map((bookmark) => (
                <div className="bookmark-row" key={bookmark.id}>
                  <button
                    className={bookmark.pageIndex === currentPageIndex ? "current-bookmark" : ""}
                    onClick={() => {
                      setBookmarksOpen(false);
                      scrollToPageIndex(bookmark.pageIndex);
                    }}
                  >
                    <span>{bookmark.title}</span>
                    <small>p. {bookmark.pageIndex + 1}</small>
                  </button>
                  <button
                    className="icon-button subtle"
                    onClick={() => removeReadingBookmark(visibleDocument.id, bookmark.id)}
                    aria-label="删除书签"
                    title="删除书签"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      ) : null}

      {redactionOpen ? (
        <div className="import-overlay" role="presentation" onMouseDown={() => setRedactionOpen(false)}>
          <section className="redaction-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Terms</p>
                <h2>编辑屏蔽词</h2>
              </div>
              <button className="icon-button subtle" onClick={() => setRedactionOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <p>{visibleDocument.sourceTitle}</p>
            <RedactionTermEditor
              value={documentRedactions[visibleDocument.bookId] ?? ""}
              onChange={(value) => setDocumentRedactionInput(visibleDocument.bookId, value)}
              placeholder="输入词语后按空格或回车"
              disabled={isImporting}
            />
            <div className="redaction-actions">
              <button className="secondary-button" onClick={() => setRedactionOpen(false)}>
                关闭
              </button>
              <button
                className="primary-button"
                onClick={async () => {
                  await refreshDocumentCharts(visibleDocument.id);
                  setRedactionOpen(false);
                }}
                disabled={isImporting}
              >
                更新图表
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ChartMeasureHost({
  documentData,
  measureRef
}: {
  documentData: PaperDocument;
  measureRef: Ref<HTMLDivElement>;
}): JSX.Element {
  const figures = collectMeasuredFigures(documentData);
  return (
    <div
      className={`chart-measure-host paper-page paper-template-${documentData.templateId} role-text has-inline-figure`}
      ref={measureRef}
      aria-hidden="true"
    >
      {figures.map((figure) => {
        const measuredFigure = figureForMeasurement(figure, documentData.templateId);
        return (
        <div
          className={measuredFigure.layout === "double_column_small" ? "chart-measure-column" : "chart-measure-span"}
          key={figure.id}
        >
          <FigureBlock figure={measuredFigure} />
        </div>
        );
      })}
    </div>
  );
}

function figureForMeasurement(figure: PaperFigure, templateId: PaperTemplateId): PaperFigure {
  return {
    ...figure,
    layout: templateId === "double-column-conference" ? "double_column_small" : "single_full_width"
  };
}

function collectMeasuredFigures(documentData: PaperDocument): PaperFigure[] {
  const seen = new Set<string>();
  return documentData.pages
    .flatMap((page) => page.figures ?? (page.figure ? [page.figure] : []))
    .filter((figure) => {
      if (seen.has(figure.id)) return false;
      seen.add(figure.id);
      return true;
    });
}

function cachedLayoutDocument(documentData: PaperDocument): PaperDocument | null {
  const cache = documentData.layoutCache;
  if (!cache || cache.version !== LAYOUT_CACHE_VERSION || cache.pages.length === 0) return null;
  return {
    ...documentData,
    pages: cache.pages
  };
}

function remapBookmarksAfterReflow(
  bookmarks: ReadingBookmark[],
  oldDocument: PaperDocument,
  reflowStartPageIndex: number
): (newDocument: PaperDocument) => ReadingBookmark[] {
  const bookmarkTargets = bookmarks.map((bookmark) => {
    const oldPage = oldDocument.pages[bookmark.pageIndex];
    return {
      bookmark,
      shouldRemap: bookmark.pageIndex >= reflowStartPageIndex,
      sourceProgress: oldPage?.sourceProgress ?? bookmark.pageIndex / Math.max(1, oldDocument.pages.length - 1),
      sourceChapterId: oldPage?.sourceChapterId,
      role: oldPage?.role
    };
  });

  return (newDocument) =>
    bookmarkTargets.map(({ bookmark, shouldRemap, sourceProgress, sourceChapterId, role }) => {
      if (!shouldRemap) return bookmark;
      const nextPageIndex = findNearestReflowedPageIndex(newDocument, reflowStartPageIndex, {
        sourceProgress,
        sourceChapterId,
        role
      });
      return {
        ...bookmark,
        pageIndex: nextPageIndex
      };
    });
}

function findNearestReflowedPageIndex(
  documentData: PaperDocument,
  reflowStartPageIndex: number,
  target: {
    sourceProgress: number;
    sourceChapterId?: string;
    role?: string;
  }
): number {
  let bestIndex = Math.max(0, Math.min(documentData.pages.length - 1, reflowStartPageIndex));
  let bestScore = Number.POSITIVE_INFINITY;

  for (const page of documentData.pages) {
    if (page.index < reflowStartPageIndex) continue;
    const progressScore = Math.abs(page.sourceProgress - target.sourceProgress);
    const chapterPenalty = target.sourceChapterId && page.sourceChapterId !== target.sourceChapterId ? 0.08 : 0;
    const rolePenalty = target.role && page.role !== target.role ? 0.14 : 0;
    const score = progressScore + chapterPenalty + rolePenalty;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = page.index;
    }
  }

  return bestIndex;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function LayoutProgress(): JSX.Element {
  return (
    <div className="inline-status layout-progress">
      <div className="status-header">
        <strong>正在整理图表版面...</strong>
        <span>90%</span>
      </div>
      <div className="progress-track" aria-label="版面整理进度">
        <span style={{ width: "90%" }} />
      </div>
      <small>正在测量图表高度并重新分页</small>
    </div>
  );
}
