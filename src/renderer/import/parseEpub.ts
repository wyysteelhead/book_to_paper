import JSZip from "jszip";
import type { ParsedBook, ParsedChapter } from "../../common/types";

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
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
  const spineIds = [...opf.getElementsByTagName("itemref")]
    .map((item) => item.getAttribute("idref"))
    .filter((id): id is string => Boolean(id));

  const chapters: ParsedChapter[] = [];

  for (const id of spineIds) {
    const item = manifest.get(id);
    if (!item || !isReadableDocument(item)) continue;

    const chapterPath = normalizePath(`${basePath}${item.href}`);
    const chapterText = await readZipText(zip, chapterPath);
    const chapterDoc = parseHtml(chapterText);
    const heading = findChapterHeading(chapterDoc) ?? `Section ${chapters.length + 1}`;
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
    if (id && href) {
      manifest.set(id, { id, href, mediaType });
    }
  }
  return manifest;
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
    return paragraphTexts.slice(0, 220);
  }

  const bodyText = normalizeWhitespace(document.body?.textContent ?? "");
  return splitLongText(bodyText).slice(0, 220);
}

function findChapterHeading(document: Document): string | undefined {
  const heading = document.querySelector("h1, h2, h3, title");
  const text = normalizeWhitespace(heading?.textContent ?? "");
  return text || undefined;
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
  return text.replace(/\s+/g, " ").trim();
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
