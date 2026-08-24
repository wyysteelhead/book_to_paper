import type { PaperFigure } from "../../../../common/types";

export function TableChart({ figure, isChinese }: { figure: PaperFigure; isChinese: boolean }): JSX.Element {
  const rows =
    figure.data?.kind === "table"
      ? [figure.data.headers, ...figure.data.rows.slice(0, 8)]
      : [
          [isChinese ? "章节" : "Section", isChinese ? "密度" : "Density", isChinese ? "信号" : "Signal"],
          ["I", "0.72", "14.8"],
          ["II", "0.64", "11.2"],
          ["III", "0.81", "18.5"]
        ];

  return (
    <div className="fake-table" style={{ gridTemplateColumns: `repeat(${rows[0]?.length ?? 3}, minmax(0, 1fr))` }}>
      {rows.flatMap((row, rowIndex) =>
        row.map((cell, cellIndex) => (
          <div key={`${rowIndex}-${cellIndex}`} className={rowIndex === 0 ? "table-head" : ""}>
            {cell}
          </div>
        ))
      )}
    </div>
  );
}
