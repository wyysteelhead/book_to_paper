import { shortLabel } from "../chartData";
import { paletteStyle } from "../palettes";

export function SeriesChart({
  labels,
  values,
  palette,
  variant = "line"
}: {
  labels: string[];
  values: number[];
  palette: string[];
  variant?: "line" | "area";
}): JSX.Element {
  const width = 520;
  const height = 190;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const spread = Math.max(1, max - min);
  const points = values.slice(0, 12).map((value, index) => {
    const x = 28 + (index / Math.max(1, Math.min(values.length, 12) - 1)) * (width - 56);
    const y = height - 28 - ((value - min) / spread) * (height - 58);
    return { x, y, value, label: labels[index] };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${points[0]?.x ?? 28},${height - 24} ${path} ${points.at(-1)?.x ?? width - 28},${height - 24}`;

  return (
    <div className="series-chart" style={paletteStyle(palette)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {[0, 0.5, 1].map((tick) => {
          const y = height - 28 - tick * (height - 58);
          return <line key={tick} x1="28" x2={width - 28} y1={y} y2={y} className="axis-grid" />;
        })}
        {variant === "area" ? <polygon points={area} className="series-area" /> : null}
        <polyline points={path} className="series-line" />
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              className="series-dot"
              style={{ stroke: palette[index % palette.length], fill: palette[(index + 1) % palette.length] }}
            />
            {index === 0 || index === points.length - 1 || point.value === max ? (
              <text x={point.x} y={Math.max(14, point.y - 8)} textAnchor="middle">
                {shortLabel(point.label)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
