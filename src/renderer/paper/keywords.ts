const stopWords = new Set([
  "the",
  "and",
  "that",
  "with",
  "this",
  "from",
  "have",
  "were",
  "他们",
  "我们",
  "你们",
  "一个",
  "自己",
  "什么",
  "没有",
  "可以",
  "因为",
  "所以",
  "但是",
  "然后"
]);

export function extractKeywords(text: string, limit = 6): string[] {
  const tokens = text.match(/[A-Za-z][A-Za-z-]{3,}|[\u4e00-\u9fa5]{2,4}/g) ?? [];
  const counts = new Map<string, number>();

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (stopWords.has(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}
