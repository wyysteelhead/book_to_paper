import { contextBridge, ipcRenderer } from "electron";
import type { ImportedBookFile, StoredLibraryData } from "../common/types";

const api = {
  importBook: async (): Promise<ImportedBookFile | null> => {
    return ipcRenderer.invoke("book:importBook");
  },
  exportPdf: async (title: string): Promise<string | null> => {
    return ipcRenderer.invoke("book:exportPdf", title);
  },
  loadLibraryCache: async (): Promise<StoredLibraryData | null> => {
    return ipcRenderer.invoke("book:loadLibraryCache");
  },
  saveLibraryCache: async (data: StoredLibraryData): Promise<void> => {
    return ipcRenderer.invoke("book:saveLibraryCache", data);
  }
};

contextBridge.exposeInMainWorld("book2paper", api);

declare global {
  interface Window {
    book2paper: typeof api;
  }
}
