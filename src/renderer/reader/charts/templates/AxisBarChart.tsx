import { shortLabel } from "../chartData";
import { paletteStyle } from "../palettes";

export function AxisBarChart({
  labels,
  values,
  fallbackOffset,
  palette
}: {
  labels?: string[];
  values?: number[];
  fallbackOffset: number;
  palette: string[];
}): JSX.Element {
  const source = values?.length
    ? values.slice(0, 8)
    : Array.from({ length: 8 }).map((_, index) => 18 + ((index * 13 + fallbackOffset * 7) % 72));
  const sourceLabels =
    labels?.slice(0, source.length) ??
    source.map((_, index) => `S${index + 1}`);
  const max = Math.max(...source, 1);
  const width = 520;
  const height = 210;
  const plotLeft = 52;
  const plotTop = 52;
  const plotBottom = 154;
  const plotHeight = plotBottom - plotTop;
  const barWidth = 34;
  const gap = (width - plotLeft - 34 - barWidth * source.length) / Math.max(1, source.length - 1);
  const fills = barFills(source.length, palette);

  return (
    <div className="axis-bar-chart" style={paletteStyle(palette)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = plotBottom - tick * plotHeight;
          return (
            <g key={tick}>
              <line x1={plotLeft} x2={width - 28} y1={y} y2={y} className="axis-grid" />
              <text x={plotLeft - 10} y={y + 4} textAnchor="end" className="axis-tick">
                {Math.round(max * tick)}
              </text>
            </g>
          );
        })}
        <line x1={plotLeft} x2={width - 28} y1={plotBottom} y2={plotBottom} className="axis-line" />
        <line x1={plotLeft} x2={plotLeft} y1={plotTop} y2={plotBottom} className="axis-line" />
        {source.map((value, index) => {
          const x = plotLeft + 12 + index * (barWidth + gap);
          const heightValue = Math.max(8, (value / max) * plotHeight);
          const y = plotBottom - heightValue;
          return (
            <g key={`${sourceLabels[index]}-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={heightValue}
                rx="2"
                fill={fills[index]}
              />
              <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" className="bar-value">
                {value}
              </text>
              <text x={x + barWidth / 2} y={plotBottom + 16} textAnchor="middle">
                {shortLabel(sourceLabels[index])}
              </text>
            </g>
          );
        })}
        <text x={width - 28} y={192} textAnchor="end" className="chart-legend">
          n={source.length}
        </text>
      </svg>
    </div>
  );
}

function barFills(count: number, palette: string[]): string[] {
  if (count >= 8 && count % 4 === 0) {
    return Array.from({ length: count }).map((_, index) => palette[index % Math.min(4, palette.length)]);
  }

  const base = palette[0];
  const accent = palette[1] ?? "#202020";
  return Array.from({ length: count }).map((_, index) => {
    const ratio = count <= 1 ? 55 : 28 + (index / (count - 1)) * 46;
    if (index === count - 1 || (count > 6 && index === Math.floor(count / 2))) {
      return accent;
    }
    return `color-mix(in srgb, ${base} ${ratio.toFixed(0)}%, #fbfaf5)`;
  });
}
