# Book2Paper 论文模板规格

## 1. 文档目标

本文档定义 Book2Paper 的论文模板系统，包括单栏模板、双栏模板、图表布局、teaser 图、caption 规则、页面评分影响和 MVP 验收标准。

主 PRD 只保留模板系统摘要；具体实现以本文档为准。

## 2. 设计原则

模板系统的目标不是生成语义完全准确的论文，而是生成视觉可信、阅读稳定、可自动滚动定位的论文式页面。

核心原则：

- 视觉上像真实论文或技术报告。
- 布局稳定，不因图表加载造成明显跳动。
- 图表、caption、编号、引用和页眉页脚要统一。
- 单栏模板优先可读性。
- 双栏模板优先学术感和信息密度。
- 摄像头自适应展示优先选择 workScore 高的图表页面。

## 3. MVP 模板

MVP 提供两个基础模板：

- `single-column-report`：单栏技术报告模板。
- `double-column-conference`：双栏会议论文模板。

后续可扩展：

- `arxiv-preprint`
- `ieee-conference`
- `acm-paper`
- `nature-article`
- `technical-report`
- `thesis-chapter`

## 4. 通用页面结构

所有模板都应支持以下区域：

- title block
- abstract
- keywords
- section
- subsection
- body text
- figure
- table
- formula
- references
- appendix
- page header
- page footer
- page number
- caption
- citation marker

页面默认采用 A4 或 Letter 近似比例。MVP 可以先固定 A4 视觉尺寸。

建议页面参数：

```ts
const pageMetrics = {
  pageSize: "a4",
  pageWidthPx: 816,
  pageMinHeightPx: 1056,
  pagePaddingTopPx: 56,
  pagePaddingRightPx: 56,
  pagePaddingBottomPx: 56,
  pagePaddingLeftPx: 56,
};
```

## 5. 单栏模板：single-column-report

### 5.1 定位

`single-column-report` 模板用于更舒适的长文阅读，同时保持技术报告、预印本或研究备忘录的视觉感。

适合：

- 技术报告。
- arXiv preprint。
- 内部研究文档。
- 长段落书籍。
- 用户真实阅读舒适度优先的场景。

### 5.2 视觉特征

- 正文单栏。
- 行宽比双栏更长。
- 页边距略大。
- 图表可以占满正文宽度。
- caption 位于图表下方。
- 页面密度中等。

### 5.3 建议排版

```css
.paper-template-single .paper-body {
  column-count: 1;
  font-size: 14px;
  line-height: 1.62;
}

.paper-template-single .figure-full {
  width: 100%;
}
```

### 5.4 单栏图表布局

#### single_full_width

一行单图，占满正文宽度。

适合：

- 章节长度柱状图。
- 高频词分布图。
- 阅读进度曲线。
- 主题演化曲线。

验收：

- 图表宽度与正文宽度一致。
- caption 位于图表下方。
- 不应跨出页面内容区域。

#### single_two_panel

一行两图，带 `(a)`、`(b)` 子图标记。

适合：

- 两个章节组对比。
- 词频和情绪曲线对比。
- 主题分布和人物出现次数对比。

验收：

- 两张图等宽。
- 子图之间间距稳定。
- 子图标记清晰。

#### single_three_panel

一行三图，带 `(a)`、`(b)`、`(c)` 子图标记。

适合：

- 三个指标的并列展示。
- 趋势、分布、对比三联图。

验收：

- 移动或窄窗口下允许降级为两行布局。
- caption 仍对应整个 figure。

#### single_stacked

上下堆叠两张图。

适合：

- 主图 + 细节图。
- 总览 + 局部放大。

验收：

- 上下图之间有明确间距。
- 子图高度不能挤压 caption。

#### single_table_figure_mix

上方图表、下方表格，或左图右表在宽页面中展示。

适合：

- 伪实验结果页。
- 章节统计表。
- 关键词频次表。

验收：

- 表格文字不溢出。
- 表头清晰。
- caption 描述图表和表格的组合含义。

## 6. 双栏模板：double-column-conference

### 6.1 定位

`double-column-conference` 模板用于生成更像正式会议论文的高密度阅读界面。它应作为 MVP 默认模板。

适合：

- ACM/IEEE/ACL/CVPR 风格会议论文。
- 工作感优先的阅读场景。
- 摄像头自适应展示的默认目标模板。

### 6.2 视觉特征

- 正文双栏。
- 栏间距紧凑但可读。
- 普通图可以嵌入单栏。
- 关键图可以跨双栏。
- caption 更紧凑。
- 页面信息密度高。

### 6.3 建议排版

```css
.paper-template-double .paper-body {
  column-count: 2;
  column-gap: 32px;
  font-size: 12px;
  line-height: 1.46;
}

.paper-template-double .figure-span {
  column-span: all;
  width: 100%;
}
```

如果浏览器对 `column-span` 支持不稳定，MVP 可以在页面模型层把跨栏 figure 作为独立 block 渲染，不依赖 CSS 多栏自动流。

### 6.4 双栏图表布局

#### double_column_small

单栏小图，嵌入左栏或右栏。

适合：

- 小型柱状图。
- 词频 top list。
- 小型趋势线。

验收：

- 宽度不超过单栏。
- caption 应为紧凑单栏 caption。
- 不应破坏正文双栏流。

#### double_column_pair

左右栏各一张小图，形成对比。

适合：

- before/after 对比。
- 两个章节组对比。
- 两种指标对比。

验收：

- 左右图顶部对齐。
- 两个子图具有 `(a)`、`(b)` 标记。
- 总 caption 跨双栏或位于图组下方。

#### double_span_teaser

页面顶部跨双栏 teaser 图。

适合：

- 第一页或第二页。
- 摄像头自适应展示目标。
- 高可信论文外观页。

验收：

- 跨双栏显示。
- 应优先编号为 `Figure 1`。
- caption 位于 teaser 下方。
- workScore 应高于普通 figure。

#### double_span_figure

正文中部或底部跨双栏大图。

适合：

- 主题演化曲线。
- 概念关系图。
- 流程图。
- 章节结构图。

验收：

- 图表横跨两栏。
- 前后正文间距稳定。
- caption 不被正文挤压。

#### double_span_with_insets

跨栏大图 + 一个或多个角落 inset 小图。

适合：

- 主流程图 + 局部统计。
- 主题网络 + 关键词分布。

验收：

- inset 不遮挡主图关键信息。
- inset 边框和背景克制。
- caption 说明 inset 含义。

#### double_grid_four

2x2 子图网格，带 `(a)` 到 `(d)` 标记。

适合：

- 四个章节或四个指标对比。
- 情绪、词频、人物、地点组合展示。

验收：

- 四个子图尺寸一致。
- 子图标记位置一致。
- 总 caption 位于网格下方。

#### double_table_span

跨双栏表格。

适合：

- 章节统计。
- 关键词频次。
- 人物/地点/术语出现次数。
- 伪 benchmark 表格。

验收：

- 表格宽度跨双栏。
- 表头醒目但不过度装饰。
- 小字号仍可读。

## 7. Teaser 图规范

Teaser 图是论文可信度最高的页面元素之一。MVP 必须支持自动生成 teaser。

### 7.1 位置

优先位置：

- abstract 后。
- 第一页底部。
- 第二页顶部。
- 自适应展示目标页。

双栏模板中优先使用 `double_span_teaser`。单栏模板中优先使用 `single_full_width`。

### 7.2 内容类型

MVP 可用规则生成：

- 章节结构流程图。
- 主题演化曲线。
- 高频概念关系图。
- 人物/地点/术语共现网络。
- 阅读进度曲线。
- 叙事强度曲线。

### 7.3 标注

Teaser 必须包含：

- `Figure 1` 编号。
- 图题。
- caption。
- 必要时包含 `(a)`、`(b)`、`(c)` 子图标记。

### 7.4 评分

Teaser 页应获得更高 workScore：

- 单栏 teaser：基础分 0.94。
- 双栏跨栏 teaser：基础分 0.96。
- 带多子图 teaser：可增加 0.02。
- 带表格或公式组合的 teaser：可增加 0.02。

最终分数不超过 1.00。

## 8. 图表生成策略

MVP 图表不追求语义完全准确，优先追求视觉可信、稳定生成、阅读时不突兀。

推荐图表类型：

- 章节长度柱状图。
- 高频词分布图。
- 主题占比 bar chart。
- 章节情绪或强度折线图。
- 人物/地点/术语出现次数表。
- 概念关系网络图。
- 方法框架流程图。
- 伪实验结果表格。

图表数据可以从以下规则得到：

- 段落长度。
- 章节长度。
- 高频词。
- 大写词、专有名词或重复短语。
- 标点密度。
- 对话密度。
- 章节位置。

## 9. Caption 与编号

### 9.1 Figure 编号

Figure 按出现顺序编号：

```text
Figure 1
Figure 2
Figure 3
```

子图使用小写字母：

```text
(a)
(b)
(c)
(d)
```

### 9.2 Caption 风格

Caption 应该像真实论文：

- 简短但具体。
- 包含图表说明。
- 可包含 citation-like 标记。
- 不要出现“这是自动生成的图”之类破坏沉浸感的文字。

示例：

```text
Figure 2. Distribution of recurring thematic signals across reconstructed narrative sections. Values are normalized by local paragraph density.
```

## 10. 页面评分影响

模板和图表布局会影响 workScore。

基础页面评分：

- teaser：0.94 到 1.00
- figure：0.90 到 1.00
- table：0.85 到 0.95
- formula：0.82 到 0.95
- references：0.78 到 0.90
- abstract：0.70 到 0.85
- dense text：0.55 到 0.75
- sparse text：0.30 到 0.55

布局加分：

- 跨栏 teaser：+0.12
- 跨栏大图：+0.10
- 2x2 多子图：+0.08
- 图表 + 表格混排：+0.07
- 单栏小图：+0.04
- 普通正文嵌图：+0.02

最终分数必须 clamp 到 0 到 1。

## 11. 数据模型

```ts
export type PaperTemplateId =
  | "single-column-report"
  | "double-column-conference";

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
    | "line"
    | "network"
    | "table"
    | "flow"
    | "multi_panel"
    | "formula";
  sourceChapterId?: string;
  workScoreBonus: number;
};
```

## 12. 渲染实现建议

### 12.1 不完全依赖 CSS Columns

CSS 多栏适合正文，但不一定适合复杂跨栏图。MVP 可以采用“页面块模型”：

- 正文段落由页面生成器分配到单栏或双栏容器。
- 跨栏图作为独立 block 插入页面。
- 单栏小图嵌入对应 column block。
- 每个 page block 有稳定高度和最小高度。

这样可以更好地控制自适应滚动目标。

### 12.2 图表渲染

MVP 推荐使用 ECharts 或轻量 SVG/Canvas 生成图表。

要求：

- 图表尺寸固定。
- 图表加载前保留占位高度。
- caption 和图表作为一个不可拆分视觉单元。
- 图表主题应克制，避免花哨配色。

### 12.3 自适应滚动锚点

每个高评分图表区域都应提供滚动锚点：

```ts
type FigureAnchor = {
  pageId: string;
  figureId: string;
  layout: FigureLayoutType;
  workScore: number;
  scrollOffsetTop: number;
};
```

摄像头自适应展示优先滚动到 figure anchor，而不是只滚到页面顶部。

## 13. MVP 验收标准

模板系统 MVP 完成需要满足：

- 用户可以选择 `single-column-report`。
- 用户可以选择 `double-column-conference`。
- 默认模板是 `double-column-conference`。
- 单栏模板至少支持一行单图、一行两图、一行三图。
- 双栏模板至少支持单栏小图、跨栏 teaser、跨栏大图、2x2 多子图。
- Teaser 图自动生成，并拥有 `Figure 1` 编号和 caption。
- 图表页面拥有高于正文页的 workScore。
- 自适应展示可以优先滚动到 teaser 或跨栏图。
- 图表和 caption 不与正文重叠。
- 页面滚动时布局不跳动。
