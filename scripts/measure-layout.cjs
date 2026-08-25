const { app, BrowserWindow, ipcMain } = require("electron");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const cachePath =
  process.argv[2] ??
  "/Users/wangyiyao/Library/Application Support/book2paper/library-cache.json";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(webContents, predicateSource, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const passed = await webContents.executeJavaScript(`Boolean((${predicateSource})())`);
    if (passed) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${predicateSource}`);
}

ipcMain.handle("book:loadLibraryCache", async () => {
  return JSON.parse(await readFile(cachePath, "utf8"));
});
ipcMain.handle("book:saveLibraryCache", async () => undefined);
ipcMain.handle("book:importBook", async () => null);
ipcMain.handle("book:exportPdf", async () => null);

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 1400,
    show: false,
    webPreferences: {
      preload: path.join(projectRoot, "out/preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  try {
    await window.loadFile(path.join(projectRoot, "out/renderer/index.html"));
    await waitFor(window.webContents, "() => document.querySelectorAll('.book-row').length > 0");
    await window.webContents.executeJavaScript("document.querySelector('.book-row').click()");
    await waitFor(window.webContents, "() => document.querySelectorAll('.paper-page[data-page-index]').length > 0");
    await wait(1800);

    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const pageStep = 1084;
        const stack = document.querySelector('.paper-stack');
        const stackTop = stack ? stack.getBoundingClientRect().top + window.scrollY : 0;

        async function renderIndex(index) {
          window.scrollTo(0, Math.max(0, stackTop + index * pageStep - window.innerHeight * 0.25));
          window.dispatchEvent(new Event('scroll'));
          await sleep(1600);
          window.dispatchEvent(new Event('scroll'));
          await sleep(1600);
        }

        function contentHeight(content) {
          const contentRect = content.getBoundingClientRect();
          const nodes = [...content.querySelectorAll('.text-fragment, .figure-block, .inline-figures, .paper-flow-span')];
          const bottom = nodes.reduce((max, node) => {
            const rect = node.getBoundingClientRect();
            if (rect.height <= 0) return max;
            return Math.max(max, rect.bottom - contentRect.top);
          }, 0);
          return Math.ceil(bottom);
        }

        function pageMetrics(index) {
          const page = document.querySelector('.paper-page[data-page-index="' + index + '"]');
          if (!page) return { index, missing: true };
          const content = page.querySelector('[data-page-content="text"]');
          if (!content) {
            return {
              index,
              pageId: page.dataset.pageId,
              role: page.dataset.pageRole,
              placeholder: page.classList.contains('paper-page-placeholder')
            };
          }
          const safeHeight = content.clientHeight || content.getBoundingClientRect().height;
          const usedHeight = contentHeight(content);
          const columns = [...content.querySelectorAll('.paper-flow-column')].map((column) => {
            const rect = column.getBoundingClientRect();
            const fragments = column.querySelectorAll('.text-fragment').length;
            const figures = column.querySelectorAll('.figure-block').length;
            return { height: Math.ceil(rect.height), fragments, figures };
          });
          return {
            index,
            pageNumber: index + 1,
            pageId: page.dataset.pageId,
            placeholder: page.classList.contains('paper-page-placeholder'),
            safeHeight,
            usedHeight,
            overflow: usedHeight - safeHeight,
            blank: safeHeight - usedHeight,
            fragments: content.querySelectorAll('.text-fragment').length,
            figures: content.querySelectorAll('.figure-block').length,
            columns
          };
        }

        await renderIndex(6);
        const p7 = pageMetrics(6);
        await renderIndex(7);
        const p8 = pageMetrics(7);
        await renderIndex(8);
        const p9 = pageMetrics(8);
        return {
          title: document.querySelector('.reader-title strong')?.textContent ?? '',
          pageCountText: document.querySelector('.reader-title small')?.textContent ?? '',
          metrics: [p7, p8, p9]
        };
      })()
    `);

    console.log(JSON.stringify(result, null, 2));
  } finally {
    window.destroy();
    app.quit();
  }
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
