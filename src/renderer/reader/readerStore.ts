import { create } from "zustand";
import type { ReadingPosition } from "../../common/types";

type ReaderState = {
  savedPosition: ReadingPosition | null;
  restoreAvailable: boolean;
  savePosition: (position: ReadingPosition) => void;
  setRestoreAvailable: (value: boolean) => void;
};

export const useReaderStore = create<ReaderState>((set) => ({
  savedPosition: null,
  restoreAvailable: false,
  savePosition: (position) => set({ savedPosition: position }),
  setRestoreAvailable: (value) => set({ restoreAvailable: value })
}));
