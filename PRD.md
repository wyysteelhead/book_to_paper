# Book2Paper 产品需求文档 PRD

## 1. 产品概述

Book2Paper 是一款跨平台桌面阅读应用。它可以把普通书籍转换成类似学术论文的阅读界面，让用户在等待 AI coding、构建、生成、自动化任务时，可以继续阅读，同时屏幕视觉上更像是在阅读论文或技术文档。

第一版不做单纯的 PDF 转换器，而是做一个基于 Electron 的桌面阅读器。它会把导入的书籍渲染成 paper 风格页面，并可选启用本地摄像头感知：当摄像头画面中出现多人时，阅读器不会立刻切屏，而是自然滚动到图表、公式、参考文献等更像论文的页面。

## 2. 产品目标

做一个本地优先、隐私友好、可多平台发布的桌面阅读器：

- 支持导入书籍。
- 将书籍内容转换成论文风格阅读页面。
- 支持连续滚动阅读。
- 自动生成摘要、关键词、章节、图表、表格、公式和参考文献样式内容。
- 给每页计算“学术/工作感”评分。
- 可选使用本地摄像头检测人数。
- 当多人持续出现时，自然滚动到高评分页面。
- 保留真实阅读位置，方便之后恢复。

## 3. 目标用户

### 3.1 核心用户

- 使用 AI coding 工具、经常等待较长时间的开发者。
- 希望在工作间隙阅读，但不想让屏幕看起来像娱乐内容的知识工作者。
- 喜欢高密度论文式阅读界面的学生、研究者或技术人员。

### 3.2 次级用户

- 想把小说、长文、电子书转换成分析式阅读形态的用户。
- 重视本地处理和隐私的用户。
- 想参与开源定制的用户。

## 4. 用户问题

在 vibe coding 或其他 AI 辅助工作流中，用户经常需要等待。等待期间如果阅读小说、散文或其他轻阅读内容，屏幕看起来可能不像在工作；如果去玩游戏或看视频，更容易被误解。

用户真正需要的是：**可以继续阅读，但界面视觉上像在认真阅读论文或技术资料，并且在有人靠近时不会出现突兀切换。**

## 5. 产品定位

Book2Paper 的定位是：

> 一个本地优先的跨平台 paper 风格自适应阅读器。

它不是：

- 普通电子书阅读器。
- 单纯 PDF 转换工具。
- 监控工具。
- 工作效率追踪工具。
- 云端文档服务。

它是：

- 书籍到论文阅读形态的转换工具。
- 具有 paper 风格渲染能力的桌面阅读器。
- 可选本地摄像头感知的自适应界面。
- 一个带一点玩笑感、但实现上严肃的开源工具。

## 6. 平台策略

### 6.1 推荐方案

第一版使用 **Electron + React + Vite + TypeScript**。

理由：

- Electron 内置 Chromium，macOS、Windows、Linux 上的渲染行为更一致。
- 摄像头、Canvas、WebGL、WASM、PDF.js、MediaPipe 等能力在 Chromium 内更稳定。
- 便于通过 GitHub Actions 构建多平台安装包。
- 前端逻辑未来可以复用到 Web 版本。

### 6.2 目标平台

MVP 发布目标：

- macOS Apple Silicon
- macOS Intel
- Windows x64
- Linux x64 AppImage
- Linux x64 deb

后续可考虑：

- Windows ARM64
- Linux ARM64
- Windows portable 版本
- 如果安装包体积成为主要问题，再评估 Tauri 版本

## 7. MVP 功能范围

### 7.1 MVP 必做

- 导入 TXT 文件。
- 将 TXT 解析成章节和段落。
- 将书籍转换为 paper document。
- 用连续滚动方式渲染论文风格页面。
- 提供 1 到 2 个基础论文模板，包括单栏模板和双栏模板。
- 自动生成标题、摘要、关键词、章节、图表、表格、公式、参考文献。
- 支持 teaser 图、跨栏大图、单栏小图、一行单图、一行多图等图表布局。
- 为每页计算 work-looking score。
- 支持本地摄像头权限开关。
- 本地检测摄像头画面中的人脸数量。
- 当多人持续出现超过设定时间，平滑滚动到附近高评分页面。
- 保存真实阅读位置。
- 多人离开后，提供低打扰的“回到原阅读位置”操作。
- 保存本地阅读进度。
- 使用 GitHub Actions 构建多平台 Release。

### 7.2 MVP 暂不做

- EPUB 导入。
- PDF 导入。
- Markdown 导入。
- DOCX 导入。
- 完整批注系统。
- 云同步。
- 移动端 App。
- LLM 语义改写。
- 插件系统。
- 完整 PDF 导出。
- Zotero 集成。

## 8. 关键用户故事

### 8.1 导入并阅读

作为用户，我希望导入一本 TXT 书籍，并以论文风格阅读它。

验收标准：

- 用户可以从本地选择 TXT 文件。
- 应用可以解析文件内容。
- 应用可以显示 paper 风格页面。
- 用户可以连续滚动阅读。
- 关闭并重新打开应用后，阅读进度不丢失。

### 8.2 Paper 化转换

作为用户，我希望普通书籍看起来像学术论文，这样屏幕视觉上更像研究或技术阅读。

验收标准：

- 页面包含标题、摘要、关键词、章节、页码、引用、图表和参考文献。
- 正文支持单栏和高密度双栏两种基础模板。
- 图表页、表格页、公式页看起来可信，并包含多种真实论文常见图表排布。
- 页面尺寸稳定，滚动时不出现明显布局跳动。

### 8.3 自适应学术展示

作为用户，我希望当另一个人出现在摄像头中时，应用自然滚动到更像论文的页面，而不是突然切屏。

验收标准：

- 摄像头检测默认关闭。
- 用户必须主动开启摄像头检测。
- 检测在本地完成。
- 多人出现后不会立刻触发动作。
- 多人持续出现超过设定时间后，应用平滑滚动到图表、表格、公式、摘要或参考文献页面。
- 应用会保存原始阅读位置。
- 只剩一人后，应用提供低调的恢复入口。

### 8.4 隐私

作为用户，我希望摄像头功能足够透明和私密。

验收标准：

- 摄像头画面只在本地处理。
- 不上传摄像头画面。
- 不录制摄像头画面。
- 不保存截图。
- 不做人脸身份识别。
- 只输出人数或 presence state。
- README 和设置页中明确说明隐私行为。

## 9. 核心流程

### 9.1 首次使用流程

1. 用户打开 Book2Paper。
2. 进入空书库页面。
3. 用户点击导入。
4. 选择本地 TXT 文件。
5. 应用解析书籍。
6. 应用生成 paper document。
7. 用户进入阅读器。
8. 用户可选开启自适应展示。
9. 应用请求摄像头权限。
10. 应用开始本地人数检测。

### 9.2 正常阅读流程

1. 用户在 paper 风格页面中阅读。
2. 应用定期保存进度。
3. 用户滚动浏览正文、图表、参考文献等页面。
4. 用户可以返回书库或进入设置。

### 9.3 多人出现流程

1. 用户在位置 A 阅读。
2. 摄像头检测到 1 张人脸。
3. 第二张人脸出现。
4. 应用进入 observing 状态。
5. 多人状态持续超过 observeMs。
6. 应用保存位置 A。
7. 应用选择附近高 workScore 页面。
8. 应用慢速滚动到目标页面。
9. 应用进入 academic_display 状态。
10. 多人离开且一人状态稳定超过 restoreDelayMs。
11. 应用进入 restore_available 状态。
12. 用户可以回到位置 A。

## 10. 功能需求

### 10.1 书库

MVP 必需：

- 空状态。
- 导入 TXT。
- 展示已导入书籍列表。
- 打开已有书籍。
- 本地保存书籍元信息。

后续：

- 删除书籍。
- 重命名生成后的 paper 标题。
- 搜索书库。
- 按阅读状态分组。

### 10.2 导入管线

MVP 必需：

- 通过 Electron 主进程读取本地 TXT 文件。
- 尽可能检测文本编码。
- 标准化换行符。
- 切分章节和段落。
- 生成稳定 book ID。
- 保存源文件元信息。

后续：

- EPUB 解析。
- PDF 文本提取。
- Markdown 解析。
- 拖拽导入。

### 10.3 Paper 生成

MVP 必需：

- 生成论文风格标题。
- 生成 abstract。
- 生成 keywords。
- 支持单栏 paper 模板。
- 支持双栏 paper 模板。
- 支持 teaser 图布局。
- 支持跨栏大图和单栏小图布局。
- 支持一行单图和一行多图布局。
- 将章节映射为 section。
- 插入 figure 页面。
- 插入 table 页面。
- 插入 formula 页面。
- 生成 references 页面。
- 给正文加入 citation-like 标记。
- 为每页标记 page role。
- 为每页计算 workScore。

第一版建议用规则生成，暂不依赖 LLM：

- 使用文件名或首个标题作为原始标题。
- 用模板生成学术化标题。
- 从前几段提炼 abstract。
- 从高频词提取 keywords。
- 每 6 到 10 页插入一个图表页。
- 在文档末尾生成 references 区。

### 10.4 论文模板系统

论文模板系统的详细规格见 [TEMPLATE_SPEC.md](/Users/wangyiyao/Documents/projects/book_to_paper/TEMPLATE_SPEC.md)。

MVP 应至少提供两个基础模板：

- `single-column-report`：单栏技术报告风格。
- `double-column-conference`：双栏会议论文风格。

MVP 必须支持的图表布局：

- teaser 图。
- 双栏跨栏大图。
- 双栏单栏小图。
- 双栏 2x2 多子图。
- 单栏一行单图。
- 单栏一行多图。
- 图表与表格混排。

MVP 默认使用双栏会议论文模板，用户可以在设置中切换到单栏技术报告模板。

### 10.5 阅读器

MVP 必需：

- 连续纵向滚动。
- 类 A4 或 Letter 的 paper 页面。
- 单栏和双栏正文。
- 页眉显示标题、section、页码。
- 支持图表、表格、公式、参考文献页面。
- 支持跨栏图、单栏图、多子图、teaser 图的稳定渲染。
- 当前章节提示。
- 保存阅读进度。
- 支持回到保存位置。

后续：

- 全屏专注模式。
- 键盘导航。
- 字号和密度设置。
- 主题。
- 高亮和批注。
- PDF 导出。

### 10.6 页面评分

每页需要计算一个“看起来像工作/论文”的评分。

页面类型：

- cover
- abstract
- text
- teaser
- figure
- table
- formula
- references
- appendix

建议评分范围：

- teaser：0.94 到 1.00
- figure：0.90 到 1.00
- table：0.85 到 0.95
- formula：0.82 到 0.95
- references：0.78 到 0.90
- abstract：0.70 到 0.85
- dense text：0.55 到 0.75
- sparse text：0.30 到 0.55

自适应展示控制器应该优先选择当前位置附近的高评分页面。

图表布局也应影响评分：

- 跨栏 teaser：+0.12
- 跨栏大图：+0.10
- 2x2 多子图：+0.08
- 单栏小图：+0.04
- 普通正文嵌图：+0.02

### 10.7 摄像头人数检测

MVP 必需：

- 请求摄像头权限。
- 获取本地摄像头流。
- 本地做人脸检测。
- 输出人脸数量。
- 支持置信度阈值。
- 支持检测间隔设置。
- 做状态平滑，避免误判。
- 不做人脸身份识别。

建议实现：

- 在 renderer 中使用 MediaPipe Tasks Vision。
- 使用隐藏 video/canvas 处理画面。
- 默认不展示摄像头预览。
- 每 250 到 500ms 处理一帧。
- 使用滚动时间窗口避免检测闪烁。

### 10.8 Presence 状态机

状态：

- disabled
- alone
- observing
- visitor_present
- academic_display
- restore_available

状态转换：

- disabled -> alone：用户开启摄像头，且检测到一人。
- alone -> observing：短暂检测到两人或更多。
- observing -> visitor_present：多人状态持续超过 observeMs。
- visitor_present -> academic_display：开始自适应滚动。
- academic_display -> restore_available：一人状态持续超过 restoreDelayMs。
- restore_available -> alone：用户恢复阅读位置或继续当前位置阅读。

默认配置：

```ts
const presenceConfig = {
  detectionIntervalMs: 300,
  observeMs: 3000,
  restoreDelayMs: 10000,
  minConfidence: 0.65,
  targetMaxDistancePages: 8,
};
```

### 10.9 自然滚动控制器

MVP 必需：

- 在自适应滚动前保存真实阅读位置。
- 基于 workScore 和距离选择目标页。
- 平滑滚动到目标页。
- 避免瞬间跳转。
- 停在目标页中最像论文的区域，例如图表、caption、公式或参考文献开头。
- academic_display 状态下避免重复触发。

目标页评分公式：

```ts
targetScore =
  page.workScore
  - distancePenalty
  + roleBonus
```

roleBonus 建议：

- teaser：+0.30
- figure：+0.25
- table：+0.20
- formula：+0.18
- references：+0.12
- abstract：+0.08
- text：+0.00

### 10.10 设置

MVP 必需：

- 开启/关闭自适应展示。
- 设置检测延迟。
- 设置恢复延迟。
- 设置优先目标页面类型。
- 设置默认论文模板。
- 展示隐私说明。
- 清除本地数据。

后续：

- 页面密度控制。
- 导出选项。
- 快捷键设置。

## 11. 非功能需求

### 11.1 隐私

- 摄像头处理必须本地完成。
- 不保存摄像头画面。
- 不上传摄像头画面。
- 不做人脸身份识别。
- MVP 不依赖云端服务。
- README 和应用设置中必须明确说明。

### 11.2 性能

- 中等大小 TXT 文件应在数秒内完成导入和转换。
- 阅读滚动应保持流畅。
- 摄像头检测不能显著拖慢机器。
- 检测频率应可配置。
- 大文档后续需要加入页面虚拟化。

### 11.3 可靠性

- 能处理格式不规范的 TXT。
- 空文件要有友好错误提示。
- 用户拒绝摄像头权限时，阅读功能仍可用。
- 人脸检测失败时，应用仍可正常阅读。

### 11.4 Electron 安全

基础配置：

```ts
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  preload: preloadPath,
}
```

renderer 不能直接访问文件系统。文件读取、保存、导出等能力通过 preload 暴露有限 API。

### 11.5 可访问性

- 文本应可选中。
- 后续支持字号调整。
- 不开启摄像头时，核心阅读功能完整可用。
- 后续支持键盘导航。

## 12. 技术架构

### 12.1 技术栈

- 桌面壳：Electron
- 前端：React
- 构建：Vite
- 语言：TypeScript
- 状态管理：Zustand
- 图表：ECharts
- 人脸检测：MediaPipe Tasks Vision
- 文本导入：Electron file dialog + filesystem bridge
- MVP 本地存储：IndexedDB 或本地 JSON store
- 后续本地存储：SQLite
- 打包：electron-builder
- CI 发布：GitHub Actions

### 12.2 进程架构

```text
Electron Main Process
├─ 应用生命周期
├─ 原生文件选择
├─ 本地文件读取
├─ 窗口创建
├─ 导出管线
└─ 安全 IPC handlers

Preload
├─ expose importBook
├─ expose saveProgress
├─ expose loadLibrary
├─ expose exportPdf
└─ validate IPC calls

Renderer
├─ React app
├─ 书库 UI
├─ paper reader
├─ paper generation pipeline
├─ camera detection
├─ presence state machine
└─ natural scroll controller
```

### 12.3 目录结构

```text
src/
├─ main/
│  ├─ main.ts
│  ├─ windows.ts
│  ├─ ipc.ts
│  └─ files.ts
├─ preload/
│  └─ index.ts
├─ common/
│  ├─ types.ts
│  └─ constants.ts
└─ renderer/
   ├─ app/
   │  ├─ App.tsx
   │  └─ routes.tsx
   ├─ library/
   │  ├─ LibraryView.tsx
   │  └─ libraryStore.ts
   ├─ import/
   │  ├─ parseTxt.ts
   │  └─ importPipeline.ts
   ├─ paper/
   │  ├─ bookToPaper.ts
   │  ├─ templates.ts
   │  ├─ figureLayouts.ts
   │  ├─ generateAbstract.ts
   │  ├─ generateFigures.ts
   │  ├─ generateReferences.ts
   │  ├─ pageScoring.ts
   │  └─ types.ts
   ├─ reader/
   │  ├─ ReaderView.tsx
   │  ├─ PaperPage.tsx
   │  ├─ scrollController.ts
   │  └─ readerStore.ts
   ├─ vision/
   │  ├─ camera.ts
   │  ├─ faceCounter.ts
   │  ├─ presenceStateMachine.ts
   │  └─ usePresenceMonitor.ts
   ├─ settings/
   │  └─ SettingsView.tsx
   └─ shared/
      ├─ components/
      └─ styles/
```

## 13. 核心数据模型

```ts
export type SourceType = "txt" | "epub" | "pdf" | "markdown";

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

export type PaperDocument = {
  id: string;
  bookId: string;
  templateId: PaperTemplateId;
  title: string;
  abstract: string;
  keywords: string[];
  sections: PaperSection[];
  pages: PaperPage[];
  references: PaperReference[];
  createdAt: number;
};

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

export type PaperPage = {
  id: string;
  index: number;
  role: PageRole;
  templateId: PaperTemplateId;
  title?: string;
  html: string;
  figureLayout?: FigureLayoutType;
  sourceChapterId?: string;
  sourceProgress: number;
  workScore: number;
};

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

export type PresenceState =
  | "disabled"
  | "alone"
  | "observing"
  | "visitor_present"
  | "academic_display"
  | "restore_available";

export type ReadingPosition = {
  bookId: string;
  paperDocumentId: string;
  pageIndex: number;
  scrollTop: number;
  updatedAt: number;
};
```

## 14. UI 需求

### 14.1 书库页

第一屏应该是可用的书库，不做营销式 landing page。

必需元素：

- 导入按钮。
- 书籍列表。
- 空状态。
- 最近打开时间。
- 阅读进度。

### 14.2 阅读页

必需元素：

- 主阅读区。
- 紧凑顶部工具栏。
- 返回书库按钮。
- 自适应展示开关。
- 设置按钮。
- 低调 presence 状态提示。
- restore_available 时显示低调恢复按钮。

视觉要求：

- 安静、工作感、克制。
- 信息密度较高，但保持可读。
- 不做营销式布局。
- 主阅读区不要出现明显的“伪装模式”文案。
- 页面要像真实学术论文或技术报告。

### 14.3 设置页

必需控件：

- 自适应展示开关。
- 检测延迟设置。
- 恢复延迟设置。
- 优先目标类型选择。
- 隐私说明。
- 清除本地数据。

## 15. 发布计划

### 15.1 v0.1 技术原型

目标：不接真实摄像头，先验证导入、转换、阅读、自然滚动闭环。

范围：

- Electron + React + Vite 应用。
- TXT 导入。
- Paper 风格渲染。
- 单栏技术报告模板。
- 双栏会议论文模板。
- Teaser 图。
- 双栏跨栏大图。
- 双栏单栏小图。
- 单栏一行单图和一行多图。
- 自动生成图表、表格、参考文献。
- 页面评分。
- 模拟“多人出现”按钮。
- 自然滚动到高评分页面。

成功标准：

- 用户可以导入 TXT 并阅读 paper 页面。
- 用户可以在单栏和双栏模板之间切换。
- 生成内容至少包含 teaser、跨栏大图、单栏小图、多子图布局。
- 模拟触发后能自然滚动到图表或参考文献页。
- 阅读位置可以保存和恢复。

### 15.2 v0.2 摄像头 MVP

目标：加入本地摄像头人数检测。

范围：

- 摄像头权限。
- 本地人脸数量检测。
- Presence 状态机。
- 真实自适应滚动触发。
- 恢复阅读位置。
- 隐私提示。

成功标准：

- 只有一人时不触发动作。
- 多人持续出现超过 observeMs 后触发自然滚动。
- 回到一人状态后可恢复原位置。
- 不保存、不上传摄像头画面。

### 15.3 v0.3 开源发布

目标：发布第一个可下载版本。

范围：

- README。
- 隐私说明。
- GitHub Actions 多平台构建。
- macOS、Windows、Linux 安装包。
- Issue templates。
- License。

成功标准：

- GitHub Release 中有目标平台安装包。
- 新用户可以从 Release 页面下载安装并运行。

### 15.4 v0.4 格式扩展

目标：提升导入能力。

范围：

- EPUB 导入。
- Markdown 导入。
- 更好的 TXT 编码检测。
- 更好的章节识别。

### 15.5 v0.5 阅读体验增强

目标：让它更像真正可长期使用的阅读器。

范围：

- 高亮。
- 笔记。
- 搜索。
- 字体控制。
- Paper 模板选择。
- 更好的图表生成。

## 16. GitHub Release 要求

### 16.1 产物

预期 Release 文件：

```text
Book2Paper-0.1.0-arm64.dmg
Book2Paper-0.1.0-x64.dmg
Book2Paper-Setup-0.1.0.exe
Book2Paper-0.1.0.AppImage
book2paper_0.1.0_amd64.deb
```

### 16.2 CI

使用 GitHub Actions matrix build：

- macos-latest 构建 macOS。
- windows-latest 构建 Windows。
- ubuntu-latest 构建 Linux。

通过版本 tag 发布：

```text
v0.1.0
v0.2.0
v0.3.0
```

## 17. 风险与应对

### 17.1 摄像头信任风险

风险：用户可能不愿意给摄像头权限。

应对：

- 默认关闭。
- 明确说明本地处理。
- 默认不显示摄像头预览。
- 开源代码便于审计。

### 17.2 产品定位误解风险

风险：产品可能被理解为单纯的“摸鱼伪装工具”。

应对：

- 公开定位为 paper-style focus reader。
- 公共文档中避免过度强调逃避工作场景。
- 强调本地阅读、隐私和文档转换。

### 17.3 跨平台摄像头风险

风险：不同系统摄像头权限和 ML 表现可能不同。

应对：

- 使用 Electron/Chromium 保持一致性。
- 提供手动模拟模式。
- 摄像头失败时不影响阅读。
- 检测逻辑保持简单。

### 17.4 性能风险

风险：大书籍生成太多 DOM 节点，导致卡顿。

应对：

- MVP 聚焦中等大小 TXT。
- 后续加入页面虚拟化。
- 缓存生成后的 paper document。

### 17.5 页面可信度风险

风险：生成的论文页面看起来太假。

应对：

- 使用真实论文感排版。
- 加入图表、表格、引用、公式、参考文献、caption。
- 视觉风格保持克制。
- 避免过度装饰。

## 18. 待确认问题

- 产品公开名称是否继续使用 Book2Paper？
- 生成后的学术标题是否保留原书名？
- 摄像头功能在 README 中如何表述更合适？
- v0.1 本地存储用 IndexedDB、JSON 文件还是 SQLite？
- 自适应滚动是否只跳转到生成页，还是也可以跳到真实正文页？
- PDF 导出应该放在摄像头 MVP 前还是后？
- v0.1 是否需要做模板编辑能力，还是只提供固定模板选择？
- Teaser 图应优先出现在第一页、第二页，还是按内容位置动态插入？

## 19. 初始实现清单

### 项目搭建

- 创建 Electron + React + Vite + TypeScript 项目。
- 配置安全 preload bridge。
- 配置应用窗口。
- 添加基础路由。
- 添加共享类型。

### 导入与生成

- 添加 TXT 导入 IPC。
- 解析 TXT 为章节和段落。
- 生成 paper document。
- 实现单栏模板。
- 实现双栏模板。
- 实现 figure layout registry。
- 生成 teaser 图。
- 生成跨栏大图、单栏小图、一行多图和表格混排。
- 生成 figure/table/reference 页面。
- 计算页面评分。

### 阅读器

- 构建书库页。
- 构建阅读页。
- 渲染 paper 页面。
- 实现连续滚动。
- 保存阅读位置。
- 添加模拟自适应触发。
- 添加自然滚动控制器。

### 摄像头

- 添加摄像头权限流程。
- 集成 MediaPipe 人脸检测。
- 添加 presence 状态机。
- 连接状态机和滚动控制器。
- 添加恢复行为。

### 发布

- 添加 electron-builder。
- 添加应用图标。
- 添加 GitHub Actions release workflow。
- 添加 README。
- 添加隐私说明。
- 添加 License。

## 20. MVP 完成标准

MVP 完成需要满足：

- 应用可以在 macOS 本地开发环境运行。
- 用户可以导入 TXT 书籍。
- 应用可以把书籍转换为 paper 风格阅读页面。
- 阅读器包含自动生成的学术风页面。
- 阅读器至少支持单栏和双栏两个模板。
- 图表系统至少支持 teaser、跨栏大图、单栏小图、一行单图、一行多图。
- 页面拥有 workScore。
- 模拟多人触发可以平滑滚动到高评分页面。
- 摄像头模式可以开启，并在本地检测人数。
- 真实多人检测可以触发同样的自然滚动行为。
- 用户可以回到真实阅读位置。
- 摄像头数据不上传、不保存。
- GitHub Actions 可以构建 macOS、Windows、Linux 发布产物。
