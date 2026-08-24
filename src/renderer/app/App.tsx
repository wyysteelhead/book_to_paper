import { LibraryView } from "../library/LibraryView";
import { ReaderView } from "../reader/ReaderView";
import { useLibraryStore } from "../library/libraryStore";
import { useEffect } from "react";
import type { CSSProperties } from "react";

export function App(): JSX.Element {
  const activeDocument = useLibraryStore((state) => state.activeDocument);
  const typography = useLibraryStore((state) => state.typography);
  const hydrateLibrary = useLibraryStore((state) => state.hydrateLibrary);

  useEffect(() => {
    void hydrateLibrary();
  }, [hydrateLibrary]);

  return (
    <main
      className="app-shell"
      style={{
        "--paper-body-font": typography.bodyFontFamily,
        "--paper-body-size": `${typography.bodyFontSize}px`,
        "--paper-body-leading": typography.bodyLineHeight,
        "--paper-title-font": typography.titleFontFamily,
        "--paper-title-size": `${typography.titleFontSize}px`,
        "--paper-title-weight": typography.titleFontWeight
      } as CSSProperties}
    >
      {activeDocument ? <ReaderView document={activeDocument} /> : <LibraryView />}
    </main>
  );
}
