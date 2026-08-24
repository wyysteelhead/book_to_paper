import { paletteStyle } from "../palettes";

export function WordCloudChart({
  labels,
  values,
  palette,
  anonymize = false
}: {
  labels: string[];
  values: number[];
  palette: string[];
  anonymize?: boolean;
}): JSX.Element {
  const max = Math.max(...values, 1);
  const displayLabels = anonymize ? fakeLabels(labels.length) : labels;
  return (
    <div className="word-cloud" style={paletteStyle(palette)}>
      {displayLabels.slice(0, 16).map((label, index) => (
        <span
          key={`${label}-${index}`}
          style={{
            color: palette[index % palette.length],
            fontSize: `${12 + ((values[index] ?? 1) / max) * 22}px`,
            transform: `rotate(${index % 3 === 0 ? -6 : index % 3 === 1 ? 4 : 0}deg)`
          }}
          title={`${label}: ${values[index] ?? 0}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function fakeLabels(count: number): string[] {
  const pool = ["甲7", "乙3", "Δ12", "Σ9", "域4", "层8", "核2", "轴6", "M31", "Q08", "R17", "T42", "信5", "参9", "组2", "列6"];
  return Array.from({ length: count }).map((_, index) => pool[index % pool.length]);
}
