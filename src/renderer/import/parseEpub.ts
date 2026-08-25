import JSZip from "jszip";
import type { ParsedBook, ParsedChapter } from "../../common/types";

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
};

type TocEntry = {
  title: string;
  path: string;
  fragment?: string;
};

export async function parseEpub(fileName: string, dataBase64: string): Promise<ParsedBook> {
  const bytes = base64ToBytes(dataBase64);
  const zip = await JSZip.loadAsync(bytes);
  const opfPath = await findOpfPath(zip);
  const opfText = await readZipText(zip, opfPath);
  const opf = parseXml(opfText);
  const basePath = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const title = readFirstText(opf, "title") ?? fileName.replace(/\.epub$/i, "");
  const manifest = readManifest(opf);
  const tocEntries = await readTocEntries(zip, opf, manifest, basePath);
  const spineIds = [...opf.getElementsByTagName("itemref")]
    .map((item) => item.getAttribute("idref"))
    .filter((id): id is string => Boolean(id));

  const chapters: ParsedChapter[] = [];

  for (const id of spineIds) {
    const item = manifest.get(id);
    if (!item || !isReadableDocument(item)) continue;

    const chapterPath = normalizePath(`${basePath}${item.href}`);
    const chapterText = await readZipText(zip, chapterPath);
    const tocForPath = tocEntries.filter((entry) => entry.path === chapterPath);
    if (tocEntries.length > 0 && tocForPath.length === 0) continue;

    if (tocForPath.some((entry) => entry.fragment)) {
      const splitChapters = splitHtmlByTocEntries(chapterText, chapterPath, tocForPath, chapters.length);
      chapters.push(...splitChapters);
      continue;
    }

    const chapterDoc = parseHtml(chapterText);
    const heading = tocForPath[0]?.title ?? findChapterHeading(chapterDoc) ?? `Section ${chapters.length + 1}`;
    const paragraphs = extractParagraphs(chapterDoc);

    if (paragraphs.length > 0) {
      chapters.push({
        id: `chapter-${chapters.length + 1}`,
        title: heading,
        paragraphs
      });
    }
  }

  return {
    id: stableId(`${fileName}:${title}:${chapters.length}`),
    title,
    chapters:
      chapters.length > 0
        ? chapters
        : [
            {
              id: "chapter-1",
              title,
              paragraphs: ["未能从 EPUB 中解析到有效正文。"]
            }
          ]
  };
}

async function findOpfPath(zip: JSZip): Promise<string> {
  const containerText = await readZipText(zip, "META-INF/container.xml");
  const container = parseXml(containerText);
  const rootfile = container.getElementsByTagName("rootfile")[0];
  const fullPath = rootfile?.getAttribute("full-path");

  if (!fullPath) {
    throw new Error("EPUB 缺少 OPF 目录文件。");
  }

  return fullPath;
}

function readManifest(opf: Document): Map<string, ManifestItem> {
  const manifest = new Map<string, ManifestItem>();
  for (const item of [...opf.getElementsByTagName("item")]) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type") ?? "";
    const properties = item.getAttribute("properties") ?? "";
    if (id && href) {
      manifest.set(id, { id, href, mediaType, properties });
    }
  }
  return manifest;
}

async function readTocEntries(
  zip: JSZip,
  opf: Document,
  manifest: Map<string, ManifestItem>,
  basePath: string
): Promise<TocEntry[]> {
  const navItem = [...manifest.values()].find((item) => item.properties?.includes("nav"));
  if (navItem) {
    const navPath = normalizePath(`${basePath}${navItem.href}`);
    const navText = await readZipText(zip, navPath);
    const navBase = navPath.includes("/") ? navPath.slice(0, navPath.lastIndexOf("/") + 1) : "";
    const navEntries = [...navText.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => tocEntryFromHref(match[1], normalizeHtmlText(match[2]), navBase))
      .filter((entry): entry is TocEntry => Boolean(entry));
    if (navEntries.length > 0) return uniqueTocEntries(navEntries);
  }

  const tocId = opf.getElementsByTagName("spine")[0]?.getAttribute("toc");
  const ncxItem =
    (tocId ? manifest.get(tocId) : undefined) ??
    [...manifest.values()].find((item) => item.mediaType.includes("ncx") || item.href.toLowerCase().endsWith(".ncx"));
  if (!ncxItem) return [];

  const ncxPath = normalizePath(`${basePath}${ncxItem.href}`);
  const ncxText = await readZipText(zip, ncxPath);
  const ncxBase = ncxPath.includes("/") ? ncxPath.slice(0, ncxPath.lastIndexOf("/") + 1) : "";
  return uniqueTocEntries(
    [...ncxText.matchAll(/<navPoint\b[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>[\s\S]*?<content\b[^>]*src=["']([^"']+)["']/gi)]
      .map((match) => tocEntryFromHref(match[2], normalizeHtmlText(match[1]), ncxBase))
      .filter((entry): entry is TocEntry => Boolean(entry))
  );
}

function tocEntryFromHref(href: string, title: string, basePath: string): TocEntry | null {
  const cleanTitle = normalizeWhitespace(title);
  if (!href || !cleanTitle) return null;
  const [rawPath, rawFragment] = href.split("#");
  const path = normalizePath(`${basePath}${decodeXmlEntities(rawPath)}`);
  const fragment = rawFragment ? decodeURIComponent(decodeXmlEntities(rawFragment)) : undefined;
  return { title: cleanTitle, path, fragment };
}

function uniqueTocEntries(entries: TocEntry[]): TocEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.path}#${entry.fragment ?? ""}:${entry.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isReadableDocument(item: ManifestItem): boolean {
  return (
    item.mediaType.includes("xhtml") ||
    item.mediaType.includes("html") ||
    item.href.endsWith(".xhtml") ||
    item.href.endsWith(".html") ||
    item.href.endsWith(".htm")
  );
}

function extractParagraphs(document: Document): string[] {
  const nodes = [...document.querySelectorAll("p, blockquote, li")] as HTMLElement[];
  const paragraphTexts = nodes
    .map((node) => normalizeWhitespace(node.textContent ?? ""))
    .filter((text) => text.length >= 12);

  if (paragraphTexts.length > 0) {
    return paragraphTexts;
  }

  const bodyText = normalizeWhitespace(document.body?.textContent ?? "");
  return splitLongText(bodyText);
}

function findChapterHeading(document: Document): string | undefined {
  const heading = document.querySelector("h1, h2, h3, h4, [class*='title'], [class*='chapter'], title");
  const text = normalizeWhitespace(heading?.textContent ?? "");
  return text || undefined;
}

function splitHtmlByTocEntries(
  html: string,
  path: string,
  entries: TocEntry[],
  chapterOffset: number
): ParsedChapter[] {
  const ranges = entries
    .map((entry, index) => ({
      entry,
      index: findFragmentIndex(html, entry.fragment) ?? index
    }))
    .sort((a, b) => a.index - b.index);
  const chapters: ParsedChapter[] = [];

  ranges.forEach(({ entry, index }, rangeIndex) => {
    const end = ranges[rangeIndex + 1]?.index ?? html.length;
    const segment = html.slice(index, end);
    const paragraphs = extractParagraphs(parseHtml(segment));
    if (paragraphs.length === 0) return;
    chapters.push({
      id: `chapter-${chapterOffset + chapters.length + 1}`,
      title: entry.title,
      paragraphs
    });
  });

  if (chapters.length > 0) return chapters;
  return [
    {
      id: `chapter-${chapterOffset + 1}`,
      title: entries[0]?.title ?? path,
      paragraphs: extractParagraphs(parseHtml(html))
    }
  ].filter((chapter) => chapter.paragraphs.length > 0);
}

function findFragmentIndex(html: string, fragment: string | undefined): number | null {
  if (!fragment) return 0;
  const escaped = escapeRegExp(fragment);
  const match = html.match(new RegExp(`<[^>]+(?:id|name)=["']${escaped}["'][^>]*>`, "i"));
  return match?.index ?? null;
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function parseHtml(text: string): Document {
  return new DOMParser().parseFromString(text, "text/html");
}

function readFirstText(document: Document, tagName: string): string | undefined {
  const element =
    document.getElementsByTagName(tagName)[0] ??
    [...document.getElementsByTagName("*")].find(
      (node) => node.localName === tagName || node.nodeName === tagName
    );
  const text = normalizeWhitespace(element?.textContent ?? "");
  return text || undefined;
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`EPUB 文件缺少 ${path}`);
  return file.async("text");
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function normalizeWhitespace(text: string): string {
  return decodeXmlEntities(text).replace(/\s+/g, " ").trim();
}

function normalizeHtmlText(html: string): string {
  return normalizeWhitespace(html.replace(/<[^>]+>/g, " "));
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitLongText(text: string): string[] {
  if (!text) return [];
  const byChineseStops = text
    .split(/(?<=[。！？!?])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  let current = "";

  for (const sentence of byChineseStops) {
    if ((current + sentence).length > 320 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs.filter((paragraph) => paragraph.length >= 12);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function stableId(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return `book-${(hash >>> 0).toString(16)}`;
}
