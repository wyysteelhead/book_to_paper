import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Download, ListTree, RotateCcw, Shield, X } from "lucide-react";
import type { PaperDocument, PaperTemplateId } from "../../common/types";
import { useLibraryStore } from "../library/libraryStore";
import { paperTemplates } from "../paper/templates";
import { PaperPage } from "./PaperPage";
import { selectAcademicTarget } from "./scrollController";
import { useReaderStore } from "./readerStore";
import { refineDocumentByMeasurements } from "./measuredPagination";
import { RedactionTermEditor } from "../library/RedactionTermEditor";

type ReaderViewProps = {
  document: PaperDocument;
};

const PAGE_RENDER_BUFFER = 4;
const PAGE_STEP = 1084;
const MAX_REFINEMENT_ROUNDS = 80;

export function ReaderView({ document }: ReaderViewProps): JSX.Element {
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [redactionOpen, setRedactionOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [layoutDocument, setLayoutDocument] = useState(document);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [renderAllPages, setRenderAllPages] = useState(false);
  const refinementRounds = useRef(0);
  const paperStackRef = useRef<HTMLDivElement | null>(null);
  const closeDocument = useLibraryStore((state) => state.closeDocument);
  const regenerateActiveDocument = useLibraryStore((state) => state.regenerateActiveDocument);
  const documentRedactions = useLibraryStore((state) => state.documentRedactions);
  const isImporting = useLibraryStore((state) => state.isImporting);
  const setDocumentRedactionInput = useLibraryStore((state) => state.setDocumentRedactionInput);
  const refreshDocumentCharts = useLibraryStore((state) => state.refreshDocumentCharts);
  const hidePageHeader = useLibraryStore((state) => state.hidePageHeader);
  const enabledChartTypes = useLibraryStore((state) => state.enabledChartTypes);
  const savedPosition = useReaderStore((state) => state.savedPosition);
  const restoreAvailable = useReaderStore((state) => state.restoreAvailable);
  const savePosition = useReaderStore((state) => state.savePosition);
  const setRestoreAvailable = useReaderStore((state) => state.setRestoreAvailable);
  const visibleDocument = layoutDocument;

  useEffect(() => {
    refinementRounds.current = 0;
    setLayoutDocument(document);
    setCurrentPageIndex(0);
  }, [document]);

  useEffect(() => {
    if (renderAllPages) return;

    const updateCurrentPage = () => {
      const stackTop = paperStackRef.current?.getBoundingClientRect().top ?? 0;
      const absoluteStackTop = window.scrollY + stackTop;
      const nextIndex = Math.max(
        0,
        Math.min(
          visibleDocument.pages.length - 1,
          Math.round((window.scrollY - absoluteStackTop + window.innerHeight * 0.45) / PAGE_STEP)
        )
      );
      setCurrentPageIndex(nextIndex);
    };

    updateCurrentPage();
    window.addEventListener("scroll", updateCurrentPage, { passive: true });
    window.addEventListener("resize", updateCurrentPage);
    return () => {
      window.removeEventListener("scroll", updateCurrentPage);
      window.removeEventListener("resize", updateCurrentPage);
    };
  }, [renderAllPages, visibleDocument.pages.length]);

  useLayoutEffect(() => {
    if (renderAllPages) return;
    if (refinementRounds.current >= MAX_REFINEMENT_ROUNDS) return;

    const frame = window.requestAnimationFrame(() => {
      const refined = refineDocumentByMeasurements(layoutDocument, {
        enabledChartTypes: Object.entries(enabledChartTypes)
          .filter(([, enabled]) => enabled)
          .map(([type]) => type as keyof typeof enabledChartTypes)
      });
      if (!refined) return;
      refinementRounds.current += 1;
      setLayoutDocument(refined);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [enabledChartTypes, layoutDocument, renderAllPages]);

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

  const scrollToPageIndex = (pageIndex: number): void => {
    const page = visibleDocument.pages[pageIndex];
    if (!page) return;
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

  const shouldRenderPage = (pageIndex: number): boolean =>
    renderAllPages || Math.abs(pageIndex - currentPageIndex) <= PAGE_RENDER_BUFFER;

  return (
    <section className="reader-view">
      <header className="reader-toolbar">
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

      <div className="paper-stack" ref={paperStackRef}>
        {visibleDocument.pages.map((page) => (
          shouldRenderPage(page.index) ? (
            <PaperPage key={page.id} page={page} documentTitle={visibleDocument.title} hidePageHeader={hidePageHeader} />
          ) : (
            <div
              key={page.id}
              className="paper-page paper-page-placeholder"
              data-page-id={page.id}
              data-page-index={page.index}
              aria-label={`Page ${page.index + 1}`}
            />
          )
        ))}
      </div>

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

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}
