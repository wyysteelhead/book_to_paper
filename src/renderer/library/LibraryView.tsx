import { FileText, Settings, Shapes, Shield, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { useLibraryStore } from "./libraryStore";
import { paperTemplates } from "../paper/templates";
import type { FigureFrequency, PaperTemplateId } from "../../common/types";
import { ChartTemplatePreview } from "./ChartTemplatePreview";
import { RedactionTermEditor } from "./RedactionTermEditor";

type LibraryTab = "books" | "settings" | "templates";

export function LibraryView(): JSX.Element {
  const [activeTab, setActiveTab] = useState<LibraryTab>("books");
  const [isImportPanelOpen, setIsImportPanelOpen] = useState(false);
  const [redactionDocumentId, setRedactionDocumentId] = useState<string | null>(null);
  const documents = useLibraryStore((state) => state.documents);
  const templateId = useLibraryStore((state) => state.templateId);
  const isImporting = useLibraryStore((state) => state.isImporting);
  const importStatus = useLibraryStore((state) => state.importStatus);
  const importError = useLibraryStore((state) => state.importError);
  const useRealStats = useLibraryStore((state) => state.useRealStats);
  const statsTimeoutMs = useLibraryStore((state) => state.statsTimeoutMs);
  const figureFrequency = useLibraryStore((state) => state.figureFrequency);
  const hidePageHeader = useLibraryStore((state) => state.hidePageHeader);
  const paperTitleTemplatesInput = useLibraryStore((state) => state.paperTitleTemplatesInput);
  const sectionTitleTemplatesInput = useLibraryStore((state) => state.sectionTitleTemplatesInput);
  const typography = useLibraryStore((state) => state.typography);
  const pendingRedactionInput = useLibraryStore((state) => state.pendingRedactionInput);
  const documentRedactions = useLibraryStore((state) => state.documentRedactions);
  const importBook = useLibraryStore((state) => state.importBook);
  const openDocument = useLibraryStore((state) => state.openDocument);
  const removeDocument = useLibraryStore((state) => state.removeDocument);
  const setTemplateId = useLibraryStore((state) => state.setTemplateId);
  const setUseRealStats = useLibraryStore((state) => state.setUseRealStats);
  const setStatsTimeoutMs = useLibraryStore((state) => state.setStatsTimeoutMs);
  const setFigureFrequency = useLibraryStore((state) => state.setFigureFrequency);
  const setHidePageHeader = useLibraryStore((state) => state.setHidePageHeader);
  const setPaperTitleTemplatesInput = useLibraryStore((state) => state.setPaperTitleTemplatesInput);
  const setSectionTitleTemplatesInput = useLibraryStore((state) => state.setSectionTitleTemplatesInput);
  const setTypography = useLibraryStore((state) => state.setTypography);
  const setPendingRedactionInput = useLibraryStore((state) => state.setPendingRedactionInput);
  const setDocumentRedactionInput = useLibraryStore((state) => state.setDocumentRedactionInput);
  const refreshDocumentCharts = useLibraryStore((state) => state.refreshDocumentCharts);
  const redactionDocument = documents.find((document) => document.id === redactionDocumentId) ?? null;

  async function startImport() {
    await importBook();
    setIsImportPanelOpen(false);
  }

  return (
    <section className="library-view">
      <header className="library-header">
        <div>
          <p className="eyebrow">Document Lab</p>
          <h1>文献结构分析工作台</h1>
        </div>
        <button className="primary-button" onClick={() => setIsImportPanelOpen(true)} disabled={isImporting}>
          <Upload size={18} />
          {isImporting ? "处理中..." : "导入"}
        </button>
      </header>

      <nav className="library-tabs" aria-label="首页视图">
        <button className={activeTab === "books" ? "active" : ""} onClick={() => setActiveTab("books")}>
          <FileText size={16} />
          已导入
        </button>
        <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}>
          <Settings size={16} />
          设置
        </button>
        <button className={activeTab === "templates" ? "active" : ""} onClick={() => setActiveTab("templates")}>
          <Shapes size={16} />
          模板预览
        </button>
      </nav>

      {importStatus ? <ImportStatusPanel status={importStatus} /> : null}
      {importError ? <div className="inline-error">{importError}</div> : null}

      <div className="library-tab-panel">
        {activeTab === "books" ? (
          documents.length === 0 ? (
            <div className="empty-library compact-empty">
              <FileText size={38} />
              <h2>还没有导入过的论文书籍</h2>
              <p>点击右上角导入按钮，选择 EPUB 或 TXT。</p>
            </div>
          ) : (
            <div className="book-list">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="book-row"
                  onClick={() => openDocument(document)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") openDocument(document);
                  }}
                >
                  <FileText size={22} />
                  <span>
                    <strong>{document.title}</strong>
                    <small>
                      {paperTemplates[document.templateId].name} · {document.pages.length} 页
                    </small>
                  </span>
                  <button
                    className="icon-button subtle redaction-document-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setRedactionDocumentId(document.id);
                    }}
                    aria-label={`编辑${document.title}的屏蔽词`}
                    title="屏蔽词"
                  >
                    <Shield size={16} />
                  </button>
                  <button
                    className="icon-button subtle remove-document-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeDocument(document.id);
                    }}
                    aria-label={`移除${document.title}`}
                    title="移除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : null}

        {activeTab === "settings" ? (
          <section className="settings-panel">
            <div>
              <h2>论文模板</h2>
              <div className="template-picker" aria-label="论文模板">
                {(Object.keys(paperTemplates) as PaperTemplateId[]).map((id) => (
                  <button
                    key={id}
                    className={templateId === id ? "segmented active" : "segmented"}
                    onClick={() => setTemplateId(id)}
                  >
                    {paperTemplates[id].name}
                  </button>
                ))}
              </div>
            </div>
            <div className="analysis-options">
              <label>
                <input
                  type="checkbox"
                  checked={useRealStats}
                  onChange={(event) => setUseRealStats(event.currentTarget.checked)}
                  disabled={isImporting}
                />
                加入真实文本统计图表
              </label>
              <label>
                超时
                <select
                  value={statsTimeoutMs}
                  onChange={(event) => setStatsTimeoutMs(Number(event.currentTarget.value))}
                  disabled={isImporting || !useRealStats}
                >
                  <option value={1000}>1 秒</option>
                  <option value={2500}>2.5 秒</option>
                  <option value={5000}>5 秒</option>
                  <option value={10000}>10 秒</option>
                </select>
              </label>
            </div>
            <div className="analysis-options">
              <label>
                <input
                  type="checkbox"
                  checked={hidePageHeader}
                  onChange={(event) => setHidePageHeader(event.currentTarget.checked)}
                />
                滚动时自动隐藏顶部栏
              </label>
            </div>
            <div className="figure-frequency-settings">
              <header>
                <h2>图表频率</h2>
                <span>{frequencyLabels[figureFrequency]}</span>
              </header>
              <input
                type="range"
                min="0"
                max={frequencyOrder.length - 1}
                step="1"
                value={frequencyOrder.indexOf(figureFrequency)}
                onChange={(event) => setFigureFrequency(frequencyOrder[Number(event.currentTarget.value)])}
              />
              <div className="frequency-scale">
                {frequencyOrder.map((frequency) => (
                  <span key={frequency}>{frequencyLabels[frequency]}</span>
                ))}
              </div>
              <p>每页图表会根据实际占用面积控制，总占比尽量不超过页面内容区的三分之一。</p>
            </div>
            <div className="section-title-settings">
              <header>
                <h2>文章标题模板</h2>
                <small>每行一个，稳定随机抽取</small>
              </header>
              <textarea
                value={paperTitleTemplatesInput}
                onChange={(event) => setPaperTitleTemplatesInput(event.currentTarget.value)}
                rows={6}
                spellCheck={false}
              />
              <p>支持占位符：{"{title}"} 原书名，{"{topic}"} 关键词组合，{"{keyword1}"}、{"{keyword2}"} 单个关键词。</p>
            </div>
            <div className="section-title-settings">
              <header>
                <h2>章节名模板</h2>
                <small>每行一个，随机抽取</small>
              </header>
              <textarea
                value={sectionTitleTemplatesInput}
                onChange={(event) => setSectionTitleTemplatesInput(event.currentTarget.value)}
                rows={7}
                spellCheck={false}
              />
              <p>支持占位符：{"{n}"} 大节序号，{"{m}"} 小节序号，{"{i}"} 全局编号。</p>
            </div>
            <div className="typography-settings">
              <div className="typography-controls">
                <h2>排版外观</h2>
                <label>
                  正文字体
                  <select
                    value={typography.bodyFontFamily}
                    onChange={(event) => setTypography({ bodyFontFamily: event.currentTarget.value })}
                  >
                    {fontOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  标题字体
                  <select
                    value={typography.titleFontFamily}
                    onChange={(event) => setTypography({ titleFontFamily: event.currentTarget.value })}
                  >
                    {fontOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  正文字号 <span>{typography.bodyFontSize}px</span>
                  <input
                    type="range"
                    min="10"
                    max="16"
                    step="0.5"
                    value={typography.bodyFontSize}
                    onChange={(event) => setTypography({ bodyFontSize: Number(event.currentTarget.value) })}
                  />
                </label>
                <label>
                  正文行高 <span>{typography.bodyLineHeight.toFixed(2)}</span>
                  <input
                    type="range"
                    min="1.25"
                    max="1.8"
                    step="0.05"
                    value={typography.bodyLineHeight}
                    onChange={(event) => setTypography({ bodyLineHeight: Number(event.currentTarget.value) })}
                  />
                </label>
                <label>
                  标题字号 <span>{typography.titleFontSize}px</span>
                  <input
                    type="range"
                    min="12"
                    max="22"
                    step="1"
                    value={typography.titleFontSize}
                    onChange={(event) => setTypography({ titleFontSize: Number(event.currentTarget.value) })}
                  />
                </label>
                <label>
                  标题粗细
                  <select
                    value={typography.titleFontWeight}
                    onChange={(event) => setTypography({ titleFontWeight: Number(event.currentTarget.value) })}
                  >
                    <option value={600}>常规标题</option>
                    <option value={700}>论文标题</option>
                    <option value={800}>加重标题</option>
                    <option value={900}>黑体强调</option>
                  </select>
                </label>
              </div>
              <TypographyPreview />
            </div>
          </section>
        ) : null}

        {activeTab === "templates" ? <ChartTemplatePreview /> : null}
      </div>

      {isImportPanelOpen ? (
        <div className="import-overlay" role="presentation" onMouseDown={() => setIsImportPanelOpen(false)}>
          <section className="import-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Import</p>
                <h2>导入 EPUB / TXT</h2>
              </div>
              <button className="icon-button subtle" onClick={() => setIsImportPanelOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <button className="drop-zone" onClick={startImport} disabled={isImporting}>
              <Upload size={34} />
              <strong>{isImporting ? "正在处理..." : "拖拽文件到这里，或点击选择文件"}</strong>
              <span>{importStatus ? importStatus.message : "支持 EPUB 和 TXT；会使用当前设置生成结构化阅读稿。"}</span>
              {importStatus ? <ProgressBar status={importStatus} /> : null}
            </button>
            <label className="import-redaction-field">
              本次导入屏蔽词
              <RedactionTermEditor
                value={pendingRedactionInput}
                onChange={setPendingRedactionInput}
                placeholder="主角名、地名、专有名词；可用空格、逗号或换行分隔"
                disabled={isImporting}
              />
            </label>
          </section>
        </div>
      ) : null}

      {redactionDocument ? (
        <div className="import-overlay" role="presentation" onMouseDown={() => setRedactionDocumentId(null)}>
          <section className="redaction-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Terms</p>
                <h2>编辑屏蔽词</h2>
              </div>
              <button className="icon-button subtle" onClick={() => setRedactionDocumentId(null)}>
                <X size={18} />
              </button>
            </header>
            <p>{redactionDocument.title}</p>
            <RedactionTermEditor
              value={documentRedactions[redactionDocument.bookId] ?? ""}
              onChange={(value) => setDocumentRedactionInput(redactionDocument.bookId, value)}
              placeholder="输入词语后按空格或回车"
              disabled={isImporting}
            />
            <div className="redaction-actions">
              <button className="secondary-button" onClick={() => setRedactionDocumentId(null)}>
                关闭
              </button>
              <button
                className="primary-button"
                onClick={async () => {
                  await refreshDocumentCharts(redactionDocument.id);
                  setRedactionDocumentId(null);
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

function ImportStatusPanel({
  status
}: {
  status: { message: string; percent: number; startedAt: number };
}): JSX.Element {
  return (
    <div className="inline-status">
      <div className="status-header">
        <strong>{status.message}</strong>
        <span>{Math.round(status.percent)}%</span>
      </div>
      <ProgressBar status={status} />
      <small>
        已用时 {formatDuration(Date.now() - status.startedAt)}
        {status.percent > 5 ? ` · 预计剩余 ${formatDuration(estimateRemainingMs(status))}` : ""}
      </small>
    </div>
  );
}

function ProgressBar({ status }: { status: { percent: number } }): JSX.Element {
  return (
    <div className="progress-track" aria-label="导入进度">
      <span style={{ width: `${Math.max(3, status.percent)}%` }} />
    </div>
  );
}

function estimateRemainingMs(status: { percent: number; startedAt: number }): number {
  const elapsed = Date.now() - status.startedAt;
  const ratio = Math.max(0.05, status.percent / 100);
  return Math.max(0, elapsed / ratio - elapsed);
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} 分 ${rest} 秒`;
}

const fontOptions = [
  { label: "论文衬线", value: `"Times New Roman", "Songti SC", "SimSun", serif` },
  { label: "宋体中文", value: `"Songti SC", "SimSun", serif` },
  { label: "系统衬线", value: `Georgia, "Times New Roman", "Songti SC", serif` },
  { label: "现代无衬线", value: `Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif` },
  { label: "等宽实验", value: `"SF Mono", Menlo, Consolas, monospace` }
];

const frequencyOrder: FigureFrequency[] = ["low", "standard", "high", "dense"];

const frequencyLabels: Record<FigureFrequency, string> = {
  low: "低",
  standard: "标准",
  high: "偏多",
  dense: "密集"
};

function TypographyPreview(): JSX.Element {
  return (
    <article className="typography-preview">
      <header>
        <span>1.2</span>
        <h3>主题复现的阶段性观察</h3>
      </header>
      <p>
        本段用于预览正文的字体、字号与行距。文本会保持论文式的两端对齐，并展示中文段落在密集阅读场景下的观感。
      </p>
      <p>
        A short English sentence is mixed here to inspect serif rhythm, numeric markers, and citation-like tokens [12].
      </p>
    </article>
  );
}
