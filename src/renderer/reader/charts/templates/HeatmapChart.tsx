import { shortLabel } from "../chartData";
import { paletteStyle } from "../palettes";

export function HeatmapChart({
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
    <div className="heatmap-chart" style={paletteStyle(palette)}>
      {values.slice(0, 18).map((value, index) => {
        const intensity = value / max;
        return (
          <div
            key={`${labels[index]}-${index}`}
            style={{
              background: `color-mix(in srgb, ${palette[index % palette.length]} ${35 + intensity * 55}%, #fffefa)`
            }}
          >
            <span>{shortLabel(labels[index])}</span>
            <strong>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}
