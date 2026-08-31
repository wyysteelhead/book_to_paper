import { Check, Clipboard, Copy, ExternalLink, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { CustomChartTemplate, PaperFigure } from "../../common/types";
import { ChartRenderer } from "../reader/charts/ChartRenderer";
import { useLibraryStore } from "./libraryStore";

const chartTypes: Array<{
  type: PaperFigure["chartType"];
  label: string;
}> = [
  { type: "bar", label: "柱状图" },
  { type: "grouped_bar", label: "多系列柱形图" },
  { type: "stacked_bar", label: "堆积条形图" },
  { type: "line", label: "折线图" },
  { type: "area", label: "面积图" },
  { type: "matrix", label: "矩阵图" },
  { type: "pie", label: "饼图" },
  { type: "scatter", label: "散点图" },
  { type: "gantt", label: "甘特图" },
  { type: "candlestick", label: "K 线图" },
  { type: "radar", label: "雷达图" },
  { type: "word_cloud", label: "词云图" },
  { type: "heatmap", label: "热力图" },
  { type: "graph", label: "Graph" },
  { type: "sankey", label: "桑基图" },
  { type: "flow", label: "流程图" },
  { type: "multi_panel", label: "多面板图" },
  { type: "plain_table", label: "单纯表格" },
  { type: "formula", label: "公式" }
];

export function ChartTemplatePreview(): JSX.Element {
  const enabledChartTypes = useLibraryStore((state) => state.enabledChartTypes);
  const setChartTypeEnabled = useLibraryStore((state) => state.setChartTypeEnabled);
  const customChartTemplates = useLibraryStore((state) => state.customChartTemplates);
  const saveCustomChartTemplate = useLibraryStore((state) => state.saveCustomChartTemplate);
  const setCustomChartTemplateEnabled = useLibraryStore((state) => state.setCustomChartTemplateEnabled);
  const removeCustomChartTemplate = useLibraryStore((state) => state.removeCustomChartTemplate);
  const [seeds, setSeeds] = useState<Record<string, number>>(
    () => Object.fromEntries(chartTypes.map((item, index) => [item.type, 7 + index * 11]))
  );
  const [customPreviewVersions, setCustomPreviewVersions] = useState<Record<string, number>>({});
  const [codePanel, setCodePanel] = useState<{
    title: string;
    code: string;
  } | null>(null);
  const [newTemplatePanel, setNewTemplatePanel] = useState<{
    name: string;
    tab: "prompt" | "model" | "paste";
    json: string;
    prompt: string;
    error: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyCurrentCode() {
    if (!codePanel) return;
    await navigator.clipboard.writeText(codePanel.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function copyNewTemplatePrompt() {
    if (!newTemplatePanel) return;
    await navigator.clipboard.writeText(newTemplatePanel.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function pasteNewTemplateDefinition() {
    if (!newTemplatePanel) return;
    const text = await navigator.clipboard.readText();
    setNewTemplatePanel({ ...newTemplatePanel, json: text, error: null });
  }

  function saveNewTemplate() {
    if (!newTemplatePanel) return;
    if (!newTemplatePanel.json.trim()) {
      setNewTemplatePanel({ ...newTemplatePanel, error: "请先把完整 JSON 模板定义粘贴到下面的输入框。" });
      return;
    }
    const parsed = parseTemplateInput(newTemplatePanel.json);
    if (!parsed.ok) {
      setNewTemplatePanel({ ...newTemplatePanel, error: parsed.error });
      return;
    }

    const now = Date.now();
    const id = parsed.figure.id || `custom-${now}`;
    saveCustomChartTemplate({
      id,
      name: newTemplatePanel.name.trim() || parsed.figure.title || "未命名模板",
      enabled: true,
      figure: {
        ...parsed.figure,
        id
      },
      createdAt: now,
      updatedAt: now
    });
    setNewTemplatePanel(null);
  }

  function deleteCustomTemplate(template: CustomChartTemplate) {
    if (!window.confirm(`删除自定义模板「${template.name}」？`)) return;
    removeCustomChartTemplate(template.id);
  }

  return (
    <section className="chart-template-preview">
      <header>
        <div>
          <p className="eyebrow">Templates</p>
          <h2>图表模板预览</h2>
        </div>
        <div className="chart-preview-actions">
          <button
            className="icon-text-button"
            onClick={() => {
              setNewTemplatePanel({
                name: "",
                tab: "paste",
                json: "",
                prompt: templatePromptFor(),
                error: null
              });
            }}
          >
            <Plus size={16} />
            新增
          </button>
          <button
            className="icon-text-button"
            onClick={() => {
              setSeeds((current) =>
                Object.fromEntries(
                  chartTypes.map((item, index) => [
                    item.type,
                    (current[item.type] ?? 7 + index * 11) + 1
                  ])
                )
              );
              setCustomPreviewVersions((current) =>
                Object.fromEntries(
                  customChartTemplates.map((template) => [
                    template.id,
                    (current[template.id] ?? 0) + 1
                  ])
                )
              );
            }}
          >
            <RefreshCw size={16} />
            全部刷新
          </button>
        </div>
      </header>
      {customChartTemplates.length > 0 ? (
        <div className="custom-template-strip" aria-label="自定义图表模板">
          {customChartTemplates.map((template) => (
            <article className="chart-gallery-card custom-template-card" key={template.id}>
              <header>
                <label className="chart-enable-toggle" title={template.enabled !== false ? "已启用" : "已停用"}>
                  <input
                    type="checkbox"
                    checked={template.enabled !== false}
                    onChange={(event) => setCustomChartTemplateEnabled(template.id, event.currentTarget.checked)}
                  />
                  <h3>{template.name}</h3>
                </label>
                <div className="chart-card-actions">
                  <button
                    className="icon-button subtle"
                    onClick={() =>
                      setCodePanel({
                        title: `${template.name}定义`,
                        code: `export const template = ${JSON.stringify(template.figure, null, 2)};\n`
                      })
                    }
                    aria-label={`编辑${template.name}定义`}
                    title="编辑定义"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-button subtle"
                    onClick={() =>
                      setCustomPreviewVersions((current) => ({
                        ...current,
                        [template.id]: (current[template.id] ?? 0) + 1
                      }))
                    }
                    aria-label={`刷新${template.name}`}
                    title="刷新预览"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="icon-button subtle danger"
                    onClick={() => deleteCustomTemplate(template)}
                    aria-label={`删除${template.name}`}
                    title="删除模板"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </header>
              <div className="figure-block">
                <ChartRenderer
                  key={`${template.id}-${customPreviewVersions[template.id] ?? 0}`}
                  figure={template.figure}
                />
                <p className="caption">{template.figure.caption}</p>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <div className="chart-gallery" aria-label="图表模板 Gallery">
        {chartTypes.map((item, index) => (
          <article className="chart-gallery-card" key={item.type}>
            <header>
              <label className="chart-enable-toggle" title={enabledChartTypes[item.type] ? "已启用" : "已停用"}>
                <input
                  type="checkbox"
                  checked={enabledChartTypes[item.type]}
                  onChange={(event) => setChartTypeEnabled(item.type, event.currentTarget.checked)}
                />
                <h3>{item.label}</h3>
              </label>
              <div className="chart-card-actions">
                <button
                  className="icon-button subtle"
                  onClick={() => {
                    setCodePanel({
                      title: `${item.label}定义`,
                      code: templateCodeFor(item.type, seeds[item.type] ?? 7 + index * 11)
                    });
                  }}
                  aria-label={`编辑${item.label}定义`}
                  title="编辑定义"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-button subtle"
                  onClick={() =>
                    setSeeds((current) => ({
                      ...current,
                      [item.type]: (current[item.type] ?? 7 + index * 11) + 1
                    }))
                  }
                  aria-label={`刷新${item.label}`}
                  title="随机切换数据和配色"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </header>
            <div className="figure-block">
              <ChartRenderer figure={previewFigure(item.type, seeds[item.type] ?? 7 + index * 11)} />
              <p className="caption">图 0. {item.label}模板的随机数据与配色预览。</p>
            </div>
          </article>
        ))}
      </div>
      {codePanel ? (
        <div className="import-overlay" role="presentation" onMouseDown={() => setCodePanel(null)}>
          <section className="template-code-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Template Code</p>
                <h2>{codePanel.title}</h2>
              </div>
              <button className="icon-button subtle" onClick={() => setCodePanel(null)}>
                <X size={18} />
              </button>
            </header>
            <p className="template-prompt-help">
              这里是当前图表模板的 JSON 定义。
            </p>
            <textarea
              value={codePanel.code}
              onChange={(event) =>
                setCodePanel({ ...codePanel, code: event.currentTarget.value })
              }
              spellCheck={false}
            />
            <footer>
              <button className="secondary-button" onClick={() => setCodePanel(null)}>
                关闭
              </button>
              <div className="template-copy-actions">
                <button className="primary-button" onClick={copyCurrentCode}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "已复制" : "复制定义"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
      {newTemplatePanel ? (
        <div className="import-overlay" role="presentation" onMouseDown={() => setNewTemplatePanel(null)}>
          <section className="template-code-panel new-template-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header className="new-template-header">
              <div>
                <p className="eyebrow">New Template</p>
                <h2>新建图表模板</h2>
              </div>
              <button className="icon-button subtle" onClick={() => setNewTemplatePanel(null)}>
                <X size={18} />
              </button>
            </header>
            <label className="template-name-field">
              <span>模板名称</span>
              <input
                value={newTemplatePanel.name}
                onChange={(event) => setNewTemplatePanel({ ...newTemplatePanel, name: event.currentTarget.value, error: null })}
                placeholder="先给这个模板起个名字"
              />
            </label>
            <div className="new-template-tabs" role="tablist" aria-label="新建模板步骤">
              <button
                className={newTemplatePanel.tab === "prompt" ? "active" : ""}
                onClick={() => setNewTemplatePanel({ ...newTemplatePanel, tab: "prompt", error: null })}
                type="button"
              >
                1 复制提示词
              </button>
              <button
                className={newTemplatePanel.tab === "model" ? "active" : ""}
                onClick={() => setNewTemplatePanel({ ...newTemplatePanel, tab: "model", error: null })}
                type="button"
              >
                2 打开大模型
              </button>
              <button
                className={newTemplatePanel.tab === "paste" ? "active" : ""}
                onClick={() => setNewTemplatePanel({ ...newTemplatePanel, tab: "paste", error: null })}
                type="button"
              >
                3 粘贴结果
              </button>
            </div>
            <div className="new-template-tab-body">
              {newTemplatePanel.tab === "prompt" ? (
                <div className="new-template-step">
                  <div className="new-template-editor-head">
                    <strong>复制这段提示词</strong>
                    <div className="template-copy-actions">
                      <button className="primary-button compact-action" onClick={copyNewTemplatePrompt}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? "已复制" : "复制提示词"}
                      </button>
                    </div>
                  </div>
                  <textarea value={newTemplatePanel.prompt} readOnly spellCheck={false} />
                </div>
              ) : null}
              {newTemplatePanel.tab === "model" ? (
                <div className="new-template-step model-instructions">
                  <h3>去大模型网站生成完整回复</h3>
                  <p>
                    打开 DeepSeek、Kimi 或其他大模型网站，把上一步复制的提示词粘贴进去。模型会返回两段代码块：第一段是 JSON 元信息，第二段是 HTML/SVG 渲染内容。
                  </p>
                  <div className="model-site-buttons">
                    <a className="primary-button" href="https://chat.deepseek.com" target="_blank" rel="noreferrer">
                      打开 DeepSeek
                      <ExternalLink size={15} />
                    </a>
                    <a className="secondary-button" href="https://www.kimi.com" target="_blank" rel="noreferrer">
                      打开 Kimi
                      <ExternalLink size={15} />
                    </a>
                  </div>
                  <p>
                    模型生成完成后，不要手动框选网页里显示出来的代码。请直接点击网页端模型回复自带的“复制”按钮，复制完整回复，然后切到“3 粘贴结果”。
                  </p>
                </div>
              ) : null}
              {newTemplatePanel.tab === "paste" ? (
                <div className="new-template-step">
                  <div className="new-template-editor-head">
                    <strong>把模型的完整输出复制回来</strong>
                    <button className="secondary-button compact-action" onClick={pasteNewTemplateDefinition}>
                      <Clipboard size={16} />
                      从剪贴板粘贴
                    </button>
                  </div>
                  {newTemplatePanel.error ? <div className="inline-error">{newTemplatePanel.error}</div> : null}
                  <textarea
                    className="new-template-textarea"
                    value={newTemplatePanel.json}
                    onChange={(event) => setNewTemplatePanel({ ...newTemplatePanel, json: event.currentTarget.value, error: null })}
                    placeholder="请粘贴网页 AI 回复的完整原文。推荐点击网页端回复自带的“复制”按钮，不要手动框选渲染后的代码。系统会自动提取第一段 ```json 和第二段 ```html / ```svg。"
                    spellCheck={false}
                  />
                </div>
              ) : null}
            </div>
            <footer>
              <button className="secondary-button" onClick={() => setNewTemplatePanel(null)}>
                关闭
              </button>
              <div className="template-copy-actions">
                <button className="primary-button" onClick={saveNewTemplate}>
                  <Plus size={16} />
                  保存模板
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function templateCodeFor(type: PaperFigure["chartType"], seed: number): string {
  const figure = previewFigure(type, seed);
  return `export const template = ${JSON.stringify(figure, null, 2)};\n`;
}

function parseTemplateInput(input: string): { ok: true; figure: PaperFigure } | { ok: false; error: string } {
  try {
    const extracted = extractTemplateSections(input);
    const jsonText = extracted.jsonText
      .replace(/^export\s+const\s+\w+\s*=\s*/u, "")
      .replace(/;$/u, "")
      .trim();
    const parsed = JSON.parse(jsonText) as Partial<PaperFigure>;
    if (!parsed || typeof parsed !== "object") return { ok: false, error: "JSON 必须是一个对象。" };
    if (!parsed.title) return { ok: false, error: "缺少 title。" };
    if (!parsed.caption) return { ok: false, error: "缺少 caption。" };
    const customRenderer = extracted.code
      ? { language: "html" as const, code: extracted.code }
      : parsed.customRenderer;
    const chartType = parsed.chartType ?? (customRenderer ? "custom" : undefined);
    if (!chartType) return { ok: false, error: "缺少 chartType，或者提供第二段 HTML/SVG 代码。" };
    return {
      ok: true,
      figure: {
        id: parsed.id ?? `custom-${Date.now()}`,
        number: parsed.number ?? 0,
        layout: parsed.layout ?? "double_column_small",
        title: parsed.title,
        caption: parsed.caption,
        chartType,
        data: parsed.data ?? (customRenderer ? { kind: "custom", props: {} } : undefined),
        customRenderer,
        workScoreBonus: parsed.workScoreBonus ?? 0.08
      }
    };
  } catch {
    return { ok: false, error: "JSON 解析失败，请确认内容是完整 JSON 对象。" };
  }
}

function extractTemplateSections(input: string): { jsonText: string; code?: string } {
  const trimmed = input.trim();
  const blocks = Array.from(trimmed.matchAll(/```(\w+)?\s*([\s\S]*?)```/gu)).map((match) => ({
    language: (match[1] ?? "").toLowerCase(),
    body: match[2].trim()
  }));
  const jsonBlock = blocks.find((block) => block.language === "json") ?? blocks[0];
  const codeBlock = blocks.find((block) => ["html", "svg", "xml"].includes(block.language)) ?? blocks.find((block) => block !== jsonBlock);
  if (jsonBlock) {
    return {
      jsonText: jsonBlock.body,
      code: codeBlock?.body
    };
  }
  return {
    jsonText: trimmed
      .replace(/^```(?:json|js|ts)?\s*/u, "")
      .replace(/\s*```$/u, "")
      .trim()
  };
}

function templatePromptFor(): string {
  return `请根据下面的 Book2Paper 自定义论文组件格式，帮我生成一个新的模板。这个模板不一定是图表，也可以是英语单选题、术语卡片、流程说明、实验面板、复杂 SVG 图、公式推导或任何看起来像论文内容的组件。

请先理解我的需求：
- 组件主题：【例如：英语单选题 / 文本情绪波动 / 章节复杂度 / 人物关系密度 / 某个学科里的专业指标】
- 组件用途：【例如：伪装成论文中的测试题 / 实验结果 / 展示章节对比 / 展示模型流程 / 展示统计摘要】
- 内容结构：【例如：一个题干 + 四个选项；或一个 SVG 网络图；或一个 2x2 实验面板】
- 视觉风格：【例如：低饱和学术风 / 红蓝对比 / 黑白灰 / 多色分组 / 更像自然科学论文】
- 内容规模：【例如：1 道题 4 个选项 / 5 行 4 列 / 6 个节点 9 条边 / 3 个系列每个系列 6 项】
- 额外限制：【例如：不要出现真实书名、人名、角色名；caption 要显得像正式论文；数值要随机但合理】

输出要求：
1. 输出两段 Markdown 代码块。
2. 第一段必须是 \`\`\`json，保存模板元信息。chartType 可以直接写 "custom"，不要被已有图表类型限制。
3. 第二段必须是 \`\`\`html，保存实际渲染内容。可以写 HTML + CSS + SVG，但不要写 script。
4. HTML 内容会被放进固定尺寸的论文图表槽里，请使用 width:100%; height:100%; overflow:hidden; box-sizing:border-box。
5. title 要像论文图表标题，caption 要像正式论文图注。
6. 请填充随机但看起来学术的内容，避免直接暴露真实书名或角色名。

第一段示例：
\`\`\`json
{
  "id": "custom-english-mcq",
  "number": 0,
  "layout": "double_column_small",
  "title": "局部语义判别题",
  "caption": "图 0. 以选择题格式呈现局部语义判别任务，用于模拟文本理解实验材料。",
  "chartType": "custom",
  "data": {
    "kind": "custom",
    "props": {
      "type": "english_mcq"
    }
  },
  "workScoreBonus": 0.08
}
\`\`\`

第二段示例：
\`\`\`html
<style>
  .mcq {
    width: 100%;
    height: 100%;
    padding: 14px 16px;
    overflow: hidden;
    border: 1px solid #c9c1b4;
    background: #fffefa;
    font-family: Inter, "Times New Roman", serif;
    color: #1f1f1d;
  }
  .mcq h4 { margin: 0 0 8px; font-size: 12px; }
  .mcq p { margin: 0 0 10px; font-size: 11px; line-height: 1.35; }
  .mcq ol { margin: 0; padding-left: 20px; display: grid; gap: 5px; font-size: 10px; }
</style>
<div class="mcq">
  <h4>Semantic Discrimination Item</h4>
  <p>Which option best preserves the causal relation implied by the source sentence?</p>
  <ol type="A">
    <li>The event follows from an external constraint.</li>
    <li>The speaker denies the observed transition.</li>
    <li>The sequence is unrelated to prior evidence.</li>
    <li>The conclusion reverses the temporal order.</li>
  </ol>
</div>
\`\`\``;
}

function previewFigure(type: PaperFigure["chartType"], seed: number): PaperFigure {
  return {
    id: `preview-${type}-${seed}`,
    number: seed,
    layout: type === "matrix" || type === "graph" ? "double_span_figure" : "double_column_small",
    title: "Preview",
    caption: "图 0. 图表模板预览。",
    chartType: type,
    data: previewData(type, seed),
    workScoreBonus: 0
  };
}

function previewData(type: PaperFigure["chartType"], seed: number): PaperFigure["data"] {
  if (type === "formula") return undefined;
  if (type === "grouped_bar" || type === "stacked_bar") return multiSeries(seed);
  if (type === "matrix") return matrix(seed);
  if (type === "pie" || type === "word_cloud") return ranked(seed);
  if (type === "scatter") return scatter(seed);
  if (type === "gantt") return gantt(seed);
  if (type === "candlestick") return candle(seed);
  if (type === "graph" || type === "network") return network(seed);
  if (type === "sankey") return sankey(seed);
  if (type === "flow") return flow(seed);
  if (type === "plain_table" || type === "table") return table(seed);
  if (type === "radar") return series(seed, randomInt(seed, 5, 8));
  if (type === "heatmap") return series(seed, randomInt(seed, 8, 18));
  if (type === "multi_panel") return series(seed, randomInt(seed, 6, 14));
  if (type === "line" || type === "area") return series(seed, randomInt(seed, 5, 14));
  return series(seed, randomInt(seed, 4, 12));
}

function labels(length: number): string[] {
  const base = ["结构", "密度", "转移", "复现", "节奏", "线索", "扰动", "校准", "回收", "语气", "场景", "冲突", "边界", "流量", "残差", "聚类", "样本", "阈值"];
  return base.slice(0, length);
}

function value(seed: number, index: number): number {
  return 18 + ((seed + 5) * (index + 3)) % 72;
}

function randomInt(seed: number, min: number, max: number): number {
  return min + Math.abs((seed * 1103515245 + 12345) >> 8) % (max - min + 1);
}

function series(seed: number, length: number): PaperFigure["data"] {
  return {
    kind: "series",
    labels: labels(length),
    values: labels(length).map((_, index) => value(seed, index))
  };
}

function ranked(seed: number): PaperFigure["data"] {
  const count = randomInt(seed, 4, 10);
  return {
    kind: "ranked",
    labels: ["甲7", "乙3", "Δ12", "Σ9", "域4", "层8", "核2", "轴6", "阈5", "簇1"].slice(0, count),
    values: Array.from({ length: count }).map((_, index) => value(seed, index))
  };
}

function matrix(seed: number): PaperFigure["data"] {
  const matrixLabels = labels(randomInt(seed, 4, 9));
  return {
    kind: "matrix",
    labels: matrixLabels,
    values: matrixLabels.map((_, row) =>
      matrixLabels.map((__, column) => (row === column ? 1 : ((((row + 2) * (column + seed + 3)) % 18) - 8) / 10))
    )
  };
}

function scatter(seed: number): PaperFigure["data"] {
  const count = randomInt(seed, 12, 42);
  return {
    kind: "scatter",
    points: Array.from({ length: count }).map((_, index) => ({
      x: 8 + index * randomInt(seed + index, 3, 7),
      y: 16 + ((index * 11 + seed * 7) % 80),
      size: 1 + ((index + seed) % 5)
    }))
  };
}

function gantt(seed: number): PaperFigure["data"] {
  const count = randomInt(seed, 4, 9);
  return {
    kind: "gantt",
    tasks: labels(count).map((label, index) => ({
      label,
      start: index * randomInt(seed + index, 5, 11),
      end: index * randomInt(seed + index, 5, 11) + randomInt(seed + index * 3, 7, 20)
    }))
  };
}

function multiSeries(seed: number): PaperFigure["data"] {
  const groupLabels = ["T1", "T2", "T3", "T4", "T5", "T6", "T7"].slice(0, randomInt(seed, 3, 7));
  const seriesCount = randomInt(seed + 2, 2, 5);
  return {
    kind: "multi_series",
    labels: groupLabels,
    series: ["A", "B", "C", "D", "E"].slice(0, seriesCount).map((name, seriesIndex) => ({
      name,
      values: groupLabels.map((_, index) => value(seed + seriesIndex * 3, index))
    }))
  };
}

function candle(seed: number): PaperFigure["data"] {
  const count = randomInt(seed, 5, 12);
  return {
    kind: "candlestick",
    labels: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"].slice(0, count),
    values: Array.from({ length: count }).map((_, index) => {
      const open = 20 + ((seed + index * 5) % 36);
      const close = open + (index % 2 === 0 ? 7 : -5);
      return { open, close, high: Math.max(open, close) + 8, low: Math.max(2, Math.min(open, close) - 7) };
    })
  };
}

function network(seed: number): PaperFigure["data"] {
  const nodes = labels(randomInt(seed, 5, 11));
  const mode = seed % 4;
  return {
    kind: "network",
    nodes,
    links: nodes.flatMap((_, index) => {
      const links: Array<[number, number, number]> = [];
      if (mode === 0 && index < nodes.length - 1) links.push([index, index + 1, 1 + ((seed + index) % 3)]);
      if (mode === 1 && index > 0) links.push([0, index, 1 + ((seed + index) % 3)]);
      if (mode === 2 && index + 2 < nodes.length) links.push([index, index + 2, 1 + ((seed + index) % 2)]);
      if (mode === 3) {
        if (index < nodes.length - 1) links.push([index, index + 1, 1 + ((seed + index) % 3)]);
        if (index + 3 < nodes.length && index % 2 === 0) links.push([index, index + 3, 2]);
      }
      return links;
    })
  };
}

function sankey(seed: number): PaperFigure["data"] {
  const nodes = ["输入", "假设", "采样", "扰动", "聚合", "校准", "复核", "回归", "归档", "输出"].slice(0, randomInt(seed, 7, 10));
  const mode = seed % 3;
  const mid = Math.floor(nodes.length / 2);
  return {
    kind: "sankey",
    nodes,
    links:
      mode === 0
        ? nodes.slice(0, mid).flatMap((_, index) => [
            { source: index, target: mid + (index % (nodes.length - mid)), value: 2 + ((seed + index) % 6) },
            ...(index + 1 < mid ? [{ source: index, target: mid + ((index + 1) % (nodes.length - mid)), value: 1 + ((seed + index) % 4) }] : [])
          ])
        : mode === 1
          ? nodes.slice(1, nodes.length - 1).map((_, index) => ({
              source: index === 0 ? 0 : index,
              target: index + 1,
              value: 2 + ((seed + index) % 7)
            }))
          : nodes.slice(0, mid).flatMap((_, index) => [
              { source: 0, target: 1 + index, value: 2 + ((seed + index) % 5) },
              { source: 1 + index, target: nodes.length - 1, value: 1 + ((seed + index) % 6) }
            ])
  };
}

function flow(seed: number): PaperFigure["data"] {
  const nodes = ["假设层", "归一化", "门控", "采样", "扰动", "聚合", "校准"].slice(0, 5 + (seed % 3));
  return {
    kind: "flow",
    nodes,
    links: nodes.flatMap((_, index) => (index < nodes.length - 1 ? ([[index, index + 1]] as Array<[number, number]>) : [])),
    variant: (["pipeline", "decision", "swimlane"] as const)[seed % 3]
  };
}

function table(seed: number): PaperFigure["data"] {
  const columnCount = randomInt(seed, 3, 6);
  const rowCount = randomInt(seed + 4, 3, 8);
  const headers = ["指标", "均值", "权重", "方差", "阈值", "备注"].slice(0, columnCount);
  return {
    kind: "table",
    headers,
    rows: labels(rowCount).map((label, rowIndex) =>
      headers.map((header, columnIndex) =>
        columnIndex === 0 ? label : header === "备注" ? `S${rowIndex + 1}` : value(seed + columnIndex * 5, rowIndex)
      )
    )
  };
}
