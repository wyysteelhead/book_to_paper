import { paletteStyle } from "../palettes";

export function RankedBars({
  labels,
  values,
  palette
}: {
  labels: string[];
  values: number[];
  palette: string[];
}): JSX.Element {
  const max = Math.max(...values, 1);
  return (
    <div className="ranked-chart" style={paletteStyle(palette)}>
      {values.slice(0, 8).map((value, index) => (
        <div className="ranked-row" key={`${labels[index]}-${index}`}>
          <span className="rank-label">{labels[index]}</span>
          <span className="rank-track">
            <span
              className="rank-fill"
              style={{ width: `${Math.max(8, (value / max) * 100)}%`, background: palette[index % palette.length] }}
            />
          </span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
