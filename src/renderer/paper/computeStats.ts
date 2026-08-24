import type { BookStats, DocumentLanguage, ParsedBook } from "../../common/types";

type StatsOptions = {
  enabled: boolean;
  timeoutMs: number;
  language: DocumentLanguage;
  redactionTerms?: string[];
  onProgress?: (message: string, percent: number) => void;
};

const stopWords = new Set([
  "的",
  "了",
  "和",
  "是",
  "在",
  "我",
  "你",
  "他",
  "她",
  "它",
  "我们",
  "他们",
  "一个",
  "没有",
  "the",
  "and",
  "that",
  "with",
  "this",
  "from",
  "have"
]);

export async function computeBookStats(
  book: ParsedBook,
  options: StatsOptions
): Promise<BookStats | undefined> {
  if (!options.enabled) return undefined;

  const started = performance.now();
  const deadline = started + options.timeoutMs;
  const stats: BookStats = {
    completed: false,
    elapsedMs: 0
  };

  const timeLeft = () => performance.now() < deadline;

  options.onProgress?.("正在统计章节长度...", 8);
  stats.chapterLengths = book.chapters.map((chapter) => ({
    title: chapter.title,
    chars: chapter.paragraphs.join("").length,
    paragraphs: chapter.paragraphs.length
  }));
  await yieldToUi();
  if (!timeLeft()) return finish(stats, started, false);

  options.onProgress?.("正在计算高频词...", 24);
  stats.topTerms = computeTopTerms(book, options.language, options.redactionTerms ?? []);
  await yieldToUi();
  if (!timeLeft()) return finish(stats, started, false);

  options.onProgress?.("正在寻找最长与最短段落...", 44);
  stats.paragraphExtremes = computeParagraphExtremes(book);
  await yieldToUi();
  if (!timeLeft()) return finish(stats, started, false);

  options.onProgress?.("正在计算标点密度...", 60);
  stats.punctuationDensity = computePunctuationDensity(book);
  await yieldToUi();
  if (!timeLeft()) return finish(stats, started, false);

  options.onProgress?.("正在估算对话密度...", 76);
  stats.dialogueDensity = computeDialogueDensity(book);
  await yieldToUi();
  if (!timeLeft()) return finish(stats, started, false);

  options.onProgress?.("正在生成补充指标...", 92);
  stats.weirdMetrics = computeWeirdMetrics(book, stats);
  return finish(stats, started, true);
}

function computeTopTerms(book: ParsedBook, language: DocumentLanguage, redactionTerms: string[]): BookStats["topTerms"] {
  const text = book.chapters.flatMap((chapter) => chapter.paragraphs).join("\n");
  const blocked = new Set(redactionTerms.map((term) => term.trim().toLowerCase()).filter(Boolean));
  const tokens =
    language === "zh"
      ? text.match(/[\u4e00-\u9fa5]{2,4}/g) ?? []
      : text.match(/[A-Za-z][A-Za-z-]{3,}/g) ?? [];
  const counts = new Map<string, number>();

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (stopWords.has(normalized)) continue;
    if (isBlockedTerm(normalized, blocked)) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count }));
}

function isBlockedTerm(term: string, blocked: Set<string>): boolean {
  for (const blockedTerm of blocked) {
    if (term === blockedTerm || term.includes(blockedTerm) || blockedTerm.includes(term)) return true;
  }
  return false;
}

function computeParagraphExtremes(book: ParsedBook): NonNullable<BookStats["paragraphExtremes"]> {
  const entries = book.chapters.flatMap((chapter) =>
    chapter.paragraphs.map((paragraph) => ({
      chapterTitle: chapter.title,
      length: paragraph.length,
      preview: paragraph.slice(0, 36)
    }))
  );
  const sorted = entries.sort((a, b) => b.length - a.length);
  return {
    longest: sorted.slice(0, 5),
    shortest: sorted
      .filter((entry) => entry.length >= 8)
      .slice(-5)
      .reverse()
  };
}

function computePunctuationDensity(book: ParsedBook): NonNullable<BookStats["punctuationDensity"]> {
  return book.chapters.slice(0, 20).map((chapter) => {
    const text = chapter.paragraphs.join("");
    const punct = text.match(/[，。！？、；：,.!?;:]/g)?.length ?? 0;
    return {
      title: chapter.title,
      density: Number(((punct / Math.max(1, text.length)) * 100).toFixed(2))
    };
  });
}

function computeDialogueDensity(book: ParsedBook): NonNullable<BookStats["dialogueDensity"]> {
  return book.chapters.slice(0, 20).map((chapter) => {
    const text = chapter.paragraphs.join("");
    const dialogueMarks = text.match(/[“”"「」]/g)?.length ?? 0;
    return {
      title: chapter.title,
      density: Number(((dialogueMarks / Math.max(1, text.length)) * 100).toFixed(2))
    };
  });
}

function computeWeirdMetrics(book: ParsedBook, stats: BookStats): NonNullable<BookStats["weirdMetrics"]> {
  const allText = book.chapters.flatMap((chapter) => chapter.paragraphs).join("");
  const longestChapter = [...(stats.chapterLengths ?? [])].sort((a, b) => b.chars - a.chars)[0];
  const questionMarks = allText.match(/[？?]/g)?.length ?? 0;
  const exclamationMarks = allText.match(/[！!]/g)?.length ?? 0;
  const ellipses = allText.match(/……|\.\.\./g)?.length ?? 0;

  return [
    { label: "最长章节", value: longestChapter?.title ?? "N/A" },
    { label: "疑问密度", value: questionMarks },
    { label: "惊叹密度", value: exclamationMarks },
    { label: "省略号频次", value: ellipses },
    { label: "平均段落长度", value: Math.round(allText.length / Math.max(1, book.chapters.flatMap((chapter) => chapter.paragraphs).length)) },
    { label: "叙事呼吸指数", value: Number(((ellipses + questionMarks * 0.6 + exclamationMarks * 0.4) / Math.max(1, book.chapters.length)).toFixed(2)) }
  ];
}

function finish(stats: BookStats, started: number, completed: boolean): BookStats {
  return {
    ...stats,
    completed,
    elapsedMs: Math.round(performance.now() - started)
  };
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
