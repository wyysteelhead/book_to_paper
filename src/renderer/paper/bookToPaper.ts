import type {
  PaperDocument,
  PaperPage,
  PaperTemplateId,
  ParsedBook,
  DocumentLanguage,
  BookStats,
  FigureFrequency,
  PaperFigure,
  ChartType
} from "../../common/types";
import { extractKeywords } from "./keywords";
import { generateFigures } from "./generateFigures";
import { getPaperTemplate } from "./templates";
import { scorePage } from "./pageScoring";
import { compactInlineLayouts, packFiguresByUnits } from "./chartConfigs";

type ParagraphEntry = {
  text: string;
  chapterId: string;
  chapterIndex: number;
  sectionTitle: string;
  sourceChapterTitle: string;
  isSectionStart: boolean;
};

const pageCharBudget = {
  "single-column-report": 1900,
  "double-column-conference": 2850
} satisfies Record<PaperTemplateId, number>;

const inlineFigureReserve = {
  "single-column-report": 320,
  "double-column-conference": 230
} satisfies Record<PaperTemplateId, number>;

export function bookToPaper(
  book: ParsedBook,
  templateId: PaperTemplateId,
  stats?: BookStats,
  options: {
    figureFrequency?: FigureFrequency;
    paperTitleTemplates?: string[];
    sectionTitleTemplates?: string[];
    enabledChartTypes?: ChartType[];
  } = {}
): PaperDocument {
  const template = getPaperTemplate(templateId);
  const allText = book.chapters.flatMap((chapter) => chapter.paragraphs).join("\n");
  const language = detectLanguage(`${book.title}\n${allText.slice(0, 2000)}`);
  const keywords = extractKeywords(allText);
  const figures = generateFigures(book, template, language, stats, {
    enabledChartTypes: options.enabledChartTypes
  });
  const paperTitle = academicTitle(book.title, keywords, language, options.paperTitleTemplates);
  const pages: PaperPage[] = [];

  pages.push({
    id: "page-cover",
    index: pages.length,
    role: "cover",
    templateId,
    language,
    title: paperTitle,
    paragraphs: [book.title],
    sourceProgress: 0,
    workScore: scorePage("cover")
  });

  pages.push({
    id: "page-abstract",
    index: pages.length,
    role: "abstract",
    templateId,
    language,
    title: language === "zh" ? "摘要" : "Abstract",
    paragraphs: [
      generateAbstract(book, language),
      `${language === "zh" ? "关键词" : "Keywords"}: ${keywords.join(", ")}`
    ],
    sourceProgress: 0.01,
    workScore: scorePage("abstract")
  });

  let figureCursor = 0;
  const flow = createParagraphFlow(book, language, options.sectionTitleTemplates);
  const budget = pageCharBudget[templateId];
  const totalParagraphs = Math.max(1, flow.length);
  let consumedParagraphs = 0;
  let cursor = 0;
  const chapterAnchors = new Map<
    string,
    { id: string; title: string; pageIndex: number; pageId: string }
  >();

  while (cursor < flow.length) {
    const start = cursor;
    const entries: ParagraphEntry[] = [];
    let charCount = 0;
    const section = flow[cursor].sectionTitle;
    const plannedFigureUnits = plannedInlineFigureUnits(
      figures,
      figureCursor,
      pages.length,
      cursor,
      flow.length,
      templateId,
      options.figureFrequency ?? "high"
    );
    const effectiveBudget = Math.max(
      templateId === "double-column-conference" ? 700 : 640,
      budget - plannedFigureUnits * inlineFigureReserve[templateId]
    );

    while (cursor < flow.length) {
      const next = flow[cursor];
      const nextLength = measureText(next.text);
      const hasMinimumFill = charCount >= effectiveBudget * 0.82;
      const wouldOverflow = charCount + nextLength > effectiveBudget;
      const isNewSection = next.sectionTitle !== section;

      if (entries.length > 0 && wouldOverflow && hasMinimumFill) break;
      if (entries.length > 0 && isNewSection && charCount >= effectiveBudget * 0.72) break;

      entries.push(next);
      charCount += nextLength + (next.isSectionStart ? 190 : 0);
      cursor += 1;
    }

    const candidateFigures = compactInlineLayouts(nextFigureWindow(figures, figureCursor, 8), template.columnMode);
    const rawFiguresToAttach =
      plannedFigureUnits > 0 && charCount <= budget - inlineFigureReserve[templateId] * 0.35
        ? packFiguresByUnits(candidateFigures, Math.max(1, plannedFigureUnits))
        : [];
    const figuresToAttach = rawFiguresToAttach;
    const figure = figuresToAttach[0];
    const density = charCount / budget;
    const chapterIndex = entries[0]?.chapterIndex ?? 0;

    pages.push({
      id: `page-text-${pages.length}-${start}`,
      index: pages.length,
      role: "text",
      templateId,
      language,
      sectionTitle: section,
      sectionMarkers: entries
        .map((entry, index) =>
          shouldShowPseudoSection(entry, index, start)
            ? {
                paragraphIndex: index,
                title: pseudoSectionTitle(entry.chapterIndex, pages.length + index, language, options.sectionTitleTemplates)
              }
            : null
        )
        .filter((marker): marker is { paragraphIndex: number; title: string } => Boolean(marker)),
      paragraphs: addCitations(
        entries.map((entry) => entry.text),
        chapterIndex
      ),
      figure,
      figures: figuresToAttach.length > 0 ? figuresToAttach : undefined,
      figureLayout: figure?.layout,
      sourceChapterId: entries[0]?.chapterId,
      sourceProgress: consumedParagraphs / totalParagraphs,
      workScore: figure
        ? Math.max(scorePage("text", undefined, density), scorePage("figure", figure.layout) - 0.08)
        : scorePage("text", undefined, density)
    });

    for (const entry of entries) {
      if (!chapterAnchors.has(entry.chapterId)) {
        chapterAnchors.set(entry.chapterId, {
          id: entry.chapterId,
          title: entry.sourceChapterTitle,
          pageIndex: pages.length - 1,
          pageId: `page-text-${pages.length - 1}-${start}`
        });
      }
    }

    consumedParagraphs += entries.length;
    figureCursor += figuresToAttach.length;
  }

  pages.push({
    id: "page-formula",
    index: pages.length,
    role: "formula",
    templateId,
    language,
    title: language === "zh" ? "形式化进程估计" : "Formalized Progression Estimate",
    paragraphs:
      language === "zh"
        ? [
            "S(t) = αD(t) + βR(t) + γC(t)",
            "其中 D 表示局部密度，R 表示复现信号强度，C 表示章节转移置信度。"
          ]
        : [
            "S(t) = alpha D(t) + beta R(t) + gamma C(t)",
            "where D denotes local density, R denotes recurring signal strength, and C denotes chapter transition confidence."
          ],
    sourceProgress: 0.96,
    workScore: scorePage("formula")
  });

  pages.push({
    id: "page-references",
    index: pages.length,
    role: "references",
    templateId,
    language,
    title: language === "zh" ? "参考文献" : "References",
    paragraphs: generateReferences(keywords, language),
    sourceProgress: 1,
    workScore: scorePage("references")
  });

  return {
    id: `paper-${book.id}-${templateId}`,
    bookId: book.id,
    templateId,
    language,
    sourceTitle: book.title,
    chapterAnchors: [...chapterAnchors.values()],
    title: paperTitle,
    abstract: pages[1].paragraphs?.[0] ?? "",
    keywords,
    pages,
    references: generateReferences(keywords, language),
    stats,
    createdAt: Date.now()
  };
}

function academicTitle(
  title: string,
  keywords: string[],
  language: DocumentLanguage,
  templates?: string[]
): string {
  const topic = language === "zh"
    ? keywords.slice(0, 2).join("与") || "叙事结构"
    : keywords.slice(0, 2).join(" and ") || "Narrative Structure";
  if (templates && templates.length > 0) {
    const selected = templates[Math.abs(stableHash(`${title}:${keywords.slice(0, 4).join(":")}`)) % templates.length];
    return fillTitleTemplate(selected, title, keywords, topic);
  }
  if (language === "zh") {
    return `文本叙事结构与主题信号的重构分析：以《${title}》为研究对象`;
  }
  return `A Structural Analysis of ${title}: Evidence from ${topic}`;
}

function fillTitleTemplate(template: string, title: string, keywords: string[], topic: string): string {
  return template
    .replaceAll("{title}", title)
    .replaceAll("{topic}", topic)
    .replaceAll("{keyword1}", keywords[0] ?? topic)
    .replaceAll("{keyword2}", keywords[1] ?? keywords[0] ?? topic);
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function generateAbstract(book: ParsedBook, language: DocumentLanguage): string {
  const sample = book.chapters
    .flatMap((chapter) => chapter.paragraphs)
    .slice(0, 4)
    .join(" ");
  const trimmed = sample.length > 360 ? `${sample.slice(0, 360)}...` : sample;
  if (language === "zh") {
    return `本文将导入文本重构为一组具有论文外观的分析性章节，在保留原始阅读顺序的同时，加入摘要、图表、章节标题与引用式标记，以支持更高密度的阅读与检视。${trimmed}`;
  }
  return `This paper-style rendering reconstructs the imported text as a sequence of analytical sections. The transformation preserves the source reading order while introducing abstract, figures, section headers, and citation-like markers for focused inspection. ${trimmed}`;
}

function sectionTitle(title: string, index: number, language: DocumentLanguage, templates?: string[]): string {
  const clean = title.replace(/^第\s*[一二三四五六七八九十百千万零〇\d]+\s*[章节回部卷篇]\s*/i, "").trim();
  return pseudoSectionTitle(index, index, language, templates);
}

function addCitations(paragraphs: string[], chapterIndex: number): string[] {
  return paragraphs.map((paragraph, index) => {
    if ((index + chapterIndex) % 3 !== 0) return paragraph;
    return `${paragraph} [${(chapterIndex + 2) * 3 + index}]`;
  });
}

function generateReferences(keywords: string[], language: DocumentLanguage): string[] {
  const terms = keywords.length > 0 ? keywords : ["narrative", "structure", "reading"];
  return terms.slice(0, 6).map((term, index) => {
    if (language === "zh") {
      return `[${index + 1}] 文献结构分析研究组. “${term} 作为重构阅读信号的形式化观察.” 自适应文档界面研究辑刊, 2026.`;
    }
    return `[${index + 1}] Document Structure Analysis Group. "${capitalize(term)} as a Reconstructed Reading Signal." Journal of Adaptive Document Interfaces, 2026.`;
  });
}

function detectLanguage(text: string): DocumentLanguage {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  return chineseChars > text.length * 0.12 ? "zh" : "en";
}

function sourceTitleLine(title: string, language: DocumentLanguage): string {
  return language === "zh" ? `研究对象原题：${title}` : `Source text under study: ${title}`;
}

function createParagraphFlow(book: ParsedBook, language: DocumentLanguage, sectionTitleTemplates?: string[]): ParagraphEntry[] {
  const firstChapter = book.chapters[0];
  const flow: ParagraphEntry[] = [
    {
      text: sourceTitleLine(book.title, language),
      chapterId: firstChapter?.id ?? "chapter-1",
      chapterIndex: 0,
      sectionTitle: sectionTitle(firstChapter?.title ?? book.title, 0, language, sectionTitleTemplates),
      sourceChapterTitle: firstChapter?.title ?? book.title,
      isSectionStart: true
    }
  ];

  book.chapters.forEach((chapter, chapterIndex) => {
    chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
      splitLongParagraph(paragraph, language).forEach((text, fragmentIndex) => flow.push({
        text,
        chapterId: chapter.id,
        chapterIndex,
        sectionTitle: sectionTitle(chapter.title, chapterIndex, language, sectionTitleTemplates),
        sourceChapterTitle: chapter.title,
        isSectionStart: paragraphIndex === 0 && fragmentIndex === 0
      }));
    });
  });

  return flow;
}

function splitLongParagraph(paragraph: string, language: DocumentLanguage): string[] {
  const limit = language === "zh" ? 150 : 260;
  if (paragraph.length <= limit) return [paragraph];

  const pieces: string[] = [];
  let remaining = paragraph.trim();
  const punctuation = language === "zh" ? /[。！？；，]/g : /[.!?;,]/g;

  while (remaining.length > limit) {
    const windowText = remaining.slice(0, limit + 40);
    let splitAt = -1;
    for (const match of windowText.matchAll(punctuation)) {
      if (match.index !== undefined && match.index > limit * 0.55) splitAt = match.index + 1;
    }
    if (splitAt === -1) splitAt = limit;
    pieces.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) pieces.push(remaining);
  return pieces;
}

function measureText(text: string): number {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  return text.length + chineseChars * 0.65;
}

function plannedInlineFigureUnits(
  figures: ReturnType<typeof generateFigures>,
  figureCursor: number,
  pageIndex: number,
  paragraphCursor: number,
  totalParagraphs: number,
  templateId: PaperTemplateId,
  frequency: FigureFrequency
): number {
  if (figures.length === 0) return 0;
  const nearEnd = paragraphCursor + 8 >= totalParagraphs;
  const maxAreaUnits = figureAreaUnitsForFrequency(frequency, templateId);

  if (templateId === "single-column-report") {
    return Math.min(maxAreaUnits, frequency === "low" ? (pageIndex % 3 === 0 ? 1 : 0) : 1);
  }

  if (nearEnd) return 1;
  if (frequency === "low") return pageIndex % 3 === 0 ? 1 : 0;
  if (frequency === "standard") return pageIndex % 4 === 0 ? Math.min(2, maxAreaUnits) : 1;
  if (frequency === "dense") return pageIndex % 3 === 0 ? maxAreaUnits : Math.min(2, maxAreaUnits);
  return pageIndex % 3 === 0 ? Math.min(3, maxAreaUnits) : Math.min(2, maxAreaUnits);
}

function nextFigureWindow(figures: PaperFigure[], cursor: number, count: number): PaperFigure[] {
  if (figures.length === 0) return [];
  return Array.from({ length: count }).map((_, offset) => {
    const absoluteIndex = cursor + offset;
    const source = figures[absoluteIndex % figures.length];
    const cycle = Math.floor(absoluteIndex / figures.length);
    if (cycle === 0) {
      return {
        ...source,
        number: absoluteIndex + 1
      };
    }
    return {
      ...source,
      id: `${source.id}-cycle-${cycle}`,
      number: absoluteIndex + 1
    };
  });
}

function figureAreaUnitsForFrequency(frequency: FigureFrequency, templateId: PaperTemplateId): number {
  if (templateId === "single-column-report") return 1;
  return frequency === "low" ? 1 : 2;
}

function pseudoSectionTitle(chapterIndex: number, seed: number, language: DocumentLanguage, customTitles?: string[]): string {
  const zhTitles = [
    "问题背景与文本结构",
    "局部信号与叙事密度",
    "主题复现的阶段性观察",
    "章节转移与语义线索",
    "案例片段的形式化分析",
    "讨论：隐含结构与阅读路径",
    "补充观察与稳健性检验"
  ];
  const enTitles = [
    "Background and Structural Context",
    "Local Signals and Narrative Density",
    "Stage-wise Thematic Recurrence",
    "Section Transitions and Semantic Cues",
    "Formal Analysis of Case Fragments",
    "Discussion: Latent Structure and Reading Path",
    "Supplementary Observations and Robustness Checks"
  ];
  const hasCustomTitles = Boolean(customTitles && customTitles.length > 0);
  const titles = hasCustomTitles ? customTitles ?? [] : language === "zh" ? zhTitles : enTitles;
  const selectedTitle = titles[Math.abs(seed + chapterIndex) % titles.length];
  const rawTitle = hasCustomTitles ? selectedTitle : `{n}.{m} ${selectedTitle}`;
  return rawTitle
    .replaceAll("{n}", `${chapterIndex + 1}`)
    .replaceAll("{m}", `${(seed % 3) + 1}`)
    .replaceAll("{i}", `${seed + 1}`)
    .replaceAll("{title}", language === "zh" ? "文本结构" : "Text Structure");
}

function shouldShowPseudoSection(entry: ParagraphEntry, localIndex: number, pageStart: number): boolean {
  if (localIndex === 0) return true;
  const seed = entry.chapterIndex * 17 + localIndex * 7 + pageStart;
  return localIndex >= 3 && seed % 9 === 0;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
