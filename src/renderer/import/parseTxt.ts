import type { ParsedBook, ParsedChapter } from "../../common/types";

const chapterPattern =
  /^(第\s*[一二三四五六七八九十百千万零〇\d]+\s*[章节回部卷篇].*|chapter\s+\d+.*|\d+[.、]\s+.+)$/i;

export function parseTxt(fileName: string, text: string): ParsedBook {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u3000/g, " ")
    .trim();

  const fallbackTitle = fileName.replace(/\.(txt|md)$/i, "");
  const lines = normalized.split("\n").map((line) => line.trim());
  const title = findTitle(lines) ?? fallbackTitle;
  const chapters = splitChapters(lines, title);

  return {
    id: stableId(`${fileName}:${normalized.slice(0, 240)}`),
    title,
    chapters
  };
}

function findTitle(lines: string[]): string | undefined {
  return lines.find((line) => line.length > 0 && line.length <= 48 && !chapterPattern.test(line));
}

function splitChapters(lines: string[], title: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  let current: ParsedChapter = {
    id: "chapter-1",
    title: title === "Untitled" ? "Introduction" : title,
    paragraphs: []
  };

  for (const line of lines) {
    if (!line) continue;

    if (chapterPattern.test(line) && current.paragraphs.length > 0) {
      chapters.push(current);
      current = {
        id: `chapter-${chapters.length + 1}`,
        title: line.slice(0, 80),
        paragraphs: []
      };
      continue;
    }

    if (line !== title) {
      current.paragraphs.push(line);
    }
  }

  if (current.paragraphs.length > 0) {
    chapters.push(current);
  }

  if (chapters.length === 0) {
    return [
      {
        id: "chapter-1",
        title,
        paragraphs: ["未能解析到有效正文。"]
      }
    ];
  }

  return chapters;
}

function stableId(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return `book-${(hash >>> 0).toString(16)}`;
}
