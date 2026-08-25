import type { CSSProperties } from "react";
import type { PaperFigure } from "../../../../common/types";

export function TableChart({ figure, isChinese }: { figure: PaperFigure; isChinese: boolean }): JSX.Element {
  const maxRows = figure.layout === "double_column_small" ? 5 : 8;
  const rows =
    figure.data?.kind === "table"
      ? [figure.data.headers, ...figure.data.rows.slice(0, maxRows - 1)]
      : [
          [isChinese ? "章节" : "Section", isChinese ? "密度" : "Density", isChinese ? "信号" : "Signal"],
          ["I", "0.72", "14.8"],
          ["II", "0.64", "11.2"],
          ["III", "0.81", "18.5"]
        ];

  return (
    <div
      className="fake-table"
      style={{
        "--table-rows": rows.length,
        gridTemplateColumns: `repeat(${rows[0]?.length ?? 3}, minmax(0, 1fr))`
      } as CSSProperties}
    >
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
