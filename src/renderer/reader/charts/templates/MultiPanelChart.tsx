import type { PaperFigure } from "../../../../common/types";
import { panelValues, shortLabel } from "../chartData";
import { pickPalette, paletteStyle } from "../palettes";

export function MultiPanelChart({ figure, palette }: { figure: PaperFigure; palette: string[] }): JSX.Element {
  if (figure.data?.kind === "series") {
    return <MetricPanels labels={figure.data.labels} values={figure.data.values} />;
  }

  return (
    <div className="multi-panel-chart" style={paletteStyle(palette)}>
      {["(a)", "(b)", "(c)", "(d)"].map((label, index) => (
        <div key={label} className="mini-chart">
          <small>{label}</small>
          <Bars offset={index} values={panelValues(figure, index)} palette={palette} />
        </div>
      ))}
    </div>
  );
}

function MetricPanels({ labels, values }: { labels: string[]; values: number[] }): JSX.Element {
  const max = Math.max(...values, 1);
  const palette = pickPalette(labels.join("|"), Math.min(4, Math.max(3, values.length)));
  return (
    <div className="metric-panels" style={paletteStyle(palette)}>
      {values.slice(0, 8).map((value, index) => (
        <div
          className="metric-panel"
          key={`${labels[index]}-${index}`}
          style={{ background: palette[index % palette.length] }}
        >
          <span>{shortLabel(labels[index])}</span>
          <strong>{value}</strong>
          <small style={{ width: `${Math.max(12, (value / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function Bars({
  offset,
  values,
  palette
}: {
  offset: number;
  values?: number[];
  palette: string[];
}): JSX.Element {
  const source = values?.length ? values : Array.from({ length: 9 }).map((_, index) => 28 + ((index * 13 + offset * 7) % 58));
  const max = Math.max(...source, 1);
  return (
    <>
      {source.slice(0, 10).map((value, index) => (
        <span
          key={index}
          title={String(value)}
          style={{
            height: `${24 + (value / max) * 66}%`,
            background: palette[index % palette.length],
            borderColor: palette[index % palette.length]
          }}
        />
      ))}
    </>
  );
}
