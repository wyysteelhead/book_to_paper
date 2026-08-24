import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { StoredLibraryData } from "../common/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 720,
    title: "Document Lab",
    backgroundColor: "#f3f2ee",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

ipcMain.handle("book:importBook", async () => {
  const result = await dialog.showOpenDialog({
    title: "导入书籍",
    properties: ["openFile"],
    filters: [{ name: "Books", extensions: ["txt", "md", "epub"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const sourcePath = result.filePaths[0];
  const extension = extname(sourcePath).toLowerCase();
  const buffer = await readFile(sourcePath);

  if (extension === ".epub") {
    return {
      kind: "epub",
      fileName: basename(sourcePath),
      sourcePath,
      dataBase64: buffer.toString("base64")
    };
  }

  const text = buffer.toString("utf8");

  return {
    kind: "text",
    fileName: basename(sourcePath),
    sourcePath,
    text
  };
});

ipcMain.handle("book:exportPdf", async (_event, title: string) => {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!window) {
    throw new Error("没有可导出的阅读窗口。");
  }

  const result = await dialog.showSaveDialog(window, {
    title: "导出 PDF",
    defaultPath: `${safeFileName(title || "Document Lab")}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const pdf = await window.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    pageSize: "A4",
    margins: { marginType: "none" }
  });
  await writeFile(result.filePath, pdf);
  return result.filePath;
});

ipcMain.handle("book:loadLibraryCache", async () => {
  try {
    const raw = await readFile(libraryCachePath(), "utf8");
    return JSON.parse(raw) as StoredLibraryData;
  } catch {
    return null;
  }
});

ipcMain.handle("book:saveLibraryCache", async (_event, data: StoredLibraryData) => {
  await mkdir(dirname(libraryCachePath()), { recursive: true });
  await writeFile(libraryCachePath(), JSON.stringify(data), "utf8");
});

function libraryCachePath(): string {
  return join(app.getPath("userData"), "library-cache.json");
}

function safeFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
