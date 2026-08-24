import type { PaperFigure } from "../../../../common/types";
import { shortLabel } from "../chartData";
import { paletteStyle } from "../palettes";

export function MatrixChart({ figure, palette }: { figure: PaperFigure; palette: string[] }): JSX.Element {
  const data = figure.data?.kind === "matrix" ? figure.data : fallbackMatrix();
  const size = 18;
  return (
    <div className="matrix-chart" style={paletteStyle(palette)}>
      <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${data.labels.length}, ${size}px)` }}>
        {data.values.flatMap((row, rowIndex) =>
          row.map((value, cellIndex) => (
            <span
              key={`${rowIndex}-${cellIndex}`}
              title={`${data.labels[rowIndex]} / ${data.labels[cellIndex]}: ${value.toFixed(2)}`}
              style={{
                background: `color-mix(in srgb, ${value >= 0 ? palette[0] : palette[1]} ${30 + Math.abs(value) * 62}%, #fffefa)`
              }}
            />
          ))
        )}
      </div>
      <small>{data.labels.map(shortLabel).join(" · ")}</small>
    </div>
  );
}

export function PieChart({ figure, palette }: { figure: PaperFigure; palette: string[] }): JSX.Element {
  const labels = figure.data?.kind === "ranked" || figure.data?.kind === "series" ? figure.data.labels.slice(0, 5) : ["A", "B", "C", "D"];
  const values = figure.data?.kind === "ranked" || figure.data?.kind === "series" ? figure.data.values.slice(0, 5) : [34, 22, 18, 13];
  const total = Math.max(1, values.reduce((sum, value) => sum + value, 0));
  let current = 0;
  const gradient = values
    .map((value, index) => {
      const start = (current / total) * 100;
      current += value;
      const end = (current / total) * 100;
      return `${palette[index % palette.length]} ${start}% ${end}%`;
    })
    .join(", ");
  return (
    <div className="pie-chart" style={paletteStyle(palette)}>
      <span style={{ background: `conic-gradient(${gradient})` }} />
      <div>
        {labels.map((label, index) => (
          <small key={label}>
            <i style={{ background: palette[index % palette.length] }} />
            {shortLabel(label)} {Math.round((values[index] / total) * 100)}%
          </small>
        ))}
      </div>
    </div>
  );
}

export function ScatterChart({ figure, palette }: { figure: PaperFigure; palette: string[] }): JSX.Element {
  const points = figure.data?.kind === "scatter" ? figure.data.points : fallbackScatter();
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const maxY = Math.max(...points.map((point) => point.y), 1);
  return (
    <div className="scatter-chart" style={paletteStyle(palette)}>
      <svg viewBox="0 0 220 150">
        <line x1="28" x2="204" y1="128" y2="128" className="axis-line" />
        <line x1="28" x2="28" y1="18" y2="128" className="axis-line" />
        {points.slice(0, 28).map((point, index) => (
          <circle
            key={`${"label" in point ? point.label : index}-${index}`}
            cx={28 + (point.x / maxX) * 172}
            cy={128 - (point.y / maxY) * 106}
            r={3 + ((point.size ?? 1) % 5)}
            fill={palette[index % palette.length]}
            opacity="0.8"
          />
        ))}
      </svg>
    </div>
  );
}

export function GanttChart({ figure, palette }: { figure: PaperFigure; palette: string[] }): JSX.Element {
  const tasks = figure.data?.kind === "gantt" ? figure.data.tasks : fallbackGantt();
  const max = Math.max(...tasks.map((task) => task.end), 1);
  const rows = tasks.slice(0, 7);
  const rowHeight = 20;
  const width = 260;
  const height = 28 + rows.length * rowHeight;
  const labelWidth = 48;
  const plotLeft = 58;
  const plotWidth = width - plotLeft - 18;
  return (
    <div className="gantt-chart" style={paletteStyle(palette)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const x = plotLeft + tick * plotWidth;
          return <line key={tick} x1={x} x2={x} y1="12" y2={height - 8} className="axis-grid" />;
        })}
        {rows.map((task, index) => {
          const y = 18 + index * rowHeight;
          const x = plotLeft + (task.start / max) * plotWidth;
          const barWidth = Math.max(12, ((task.end - task.start) / max) * plotWidth);
          return (
            <g key={`${task.label}-${index}`}>
              <text x={labelWidth} y={y + 9} textAnchor="end">
                {shortLabel(task.label)}
              </text>
              <rect x={plotLeft} y={y + 1} width={plotWidth} height="10" fill="#f1ede4" />
              <rect
                x={Math.min(x, plotLeft + plotWidth - 6)}
                y={y}
                width={Math.min(barWidth, plotLeft + plotWidth - x)}
                height="12"
                rx="2"
                fill={palette[index % palette.length]}
              />
            </g>
          );
        })}
        <line x1={plotLeft} x2={plotLeft + plotWidth} y1={height - 8} y2={height - 8} className="axis-line" />
      </svg>
    </div>
  );
}

export function MultiSeriesBarChart({
  figure,
  palette,
  stacked
}: {
  figure: PaperFigure;
  palette: string[];
  stacked: boolean;
}): JSX.Element {
  const data = figure.data?.kind === "multi_series" ? figure.data : fallbackMultiSeries();
  const labels = data.labels.slice(0, 5);
  const series = data.series.slice(0, 4);
  const totals = data.labels.map((_, index) =>
    data.series.reduce((sum, series) => sum + (series.values[index] ?? 0), 0)
  );
  const max = Math.max(...(stacked ? totals : series.flatMap((item) => item.values)), 1);
  const width = 260;
  const height = 170;
  const plotLeft = 28;
  const plotRight = 248;
  const plotTop = 18;
  const plotBottom = 138;
  const plotHeight = plotBottom - plotTop;
  const groupWidth = (plotRight - plotLeft) / labels.length;
  return (
    <div className={stacked ? "stacked-bar-chart" : "grouped-bar-chart"} style={paletteStyle(palette)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = plotBottom - tick * plotHeight;
          return <line key={tick} x1={plotLeft} x2={plotRight} y1={y} y2={y} className="axis-grid" />;
        })}
        <line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} className="axis-line" />
        {labels.map((label, groupIndex) => {
          const groupX = plotLeft + groupIndex * groupWidth;
          const barAreaWidth = groupWidth * 0.62;
          const baseX = groupX + (groupWidth - barAreaWidth) / 2;
          let stackedY = plotBottom;
          return (
            <g key={label}>
              {series.map((item, seriesIndex) => {
                const value = item.values[groupIndex] ?? 0;
                const barHeight = Math.max(4, (value / max) * plotHeight);
                if (stacked) {
                  stackedY -= barHeight;
                  return (
                    <rect
                      key={item.name}
                      x={baseX}
                      y={stackedY}
                      width={barAreaWidth}
                      height={barHeight}
                      fill={palette[seriesIndex % palette.length]}
                    />
                  );
                }
                const barWidth = barAreaWidth / series.length - 1.5;
                return (
                  <rect
                    key={item.name}
                    x={baseX + seriesIndex * (barWidth + 1.5)}
                    y={plotBottom - barHeight}
                    width={barWidth}
                    height={barHeight}
                    fill={palette[seriesIndex % palette.length]}
                  />
                );
              })}
              <text x={groupX + groupWidth / 2} y="156" textAnchor="middle">
                {shortLabel(label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function CandlestickChart({ figure, palette }: { figure: PaperFigure; palette: string[] }): JSX.Element {
  const data = figure.data?.kind === "candlestick" ? figure.data : fallbackCandle();
  const high = Math.max(...data.values.map((item) => item.high), 1);
  const low = Math.min(...data.values.map((item) => item.low), 0);
  const spread = Math.max(1, high - low);
  return (
    <div className="candlestick-chart" style={paletteStyle(palette)}>
      <svg viewBox="0 0 240 150">
        {data.values.slice(0, 10).map((item, index) => {
          const x = 24 + index * 20;
          const yHigh = 124 - ((item.high - low) / spread) * 104;
          const yLow = 124 - ((item.low - low) / spread) * 104;
          const yOpen = 124 - ((item.open - low) / spread) * 104;
          const yClose = 124 - ((item.close - low) / spread) * 104;
          const up = item.close >= item.open;
          return (
            <g key={`${data.labels[index]}-${index}`}>
              <line x1={x} x2={x} y1={yHigh} y2={yLow} className="axis-line" />
              <rect
                x={x - 5}
                y={Math.min(yOpen, yClose)}
                width="10"
                height={Math.max(4, Math.abs(yOpen - yClose))}
                fill={up ? palette[0] : palette[1]}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function RadarChart({ figure, palette }: { figure: PaperFigure; palette: string[] }): JSX.Element {
  const labels = figure.data?.kind === "series" ? figure.data.labels.slice(0, 7) : fallbackRadar().labels;
  const values = figure.data?.kind === "series" ? figure.data.values.slice(0, 7) : fallbackRadar().values;
  const max = Math.max(...values, 1);
  const center = 80;
  const radius = 58;
  const points = values.map((value, index) => {
    const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
    const distance = (value / max) * radius;
    return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
  });
  return (
    <div className="radar-chart" style={paletteStyle(palette)}>
      <svg viewBox="0 0 160 160">
        {[0.33, 0.66, 1].map((scale) => (
          <circle key={scale} cx={center} cy={center} r={radius * scale} className="axis-grid" fill="none" />
        ))}
        <polygon points={points.join(" ")} />
        {labels.map((label, index) => {
          const angle = -Math.PI / 2 + (index / labels.length) * Math.PI * 2;
          return (
            <text key={label} x={center + Math.cos(angle) * 70} y={center + Math.sin(angle) * 70}>
              {shortLabel(label)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function GraphChart({ figure, palette }: { figure: PaperFigure; palette: string[] }): JSX.Element {
  const data = figure.data?.kind === "network" ? figure.data : fallbackNetwork();
  const nodes = graphNodePositions(data.nodes.slice(0, 11), figure.number);
  return (
    <div className="graph-chart" style={paletteStyle(palette)}>
      <svg viewBox="0 0 220 150">
        {data.links.slice(0, 22).map(([source, target, weight], index) => {
          const from = nodes[source % nodes.length];
          const to = nodes[target % nodes.length];
          const curved = (figure.number + index) % 3 === 0;
          return curved ? (
            <path
              key={`${source}-${target}-${index}`}
              d={`M${from.x} ${from.y} Q${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - 22} ${to.x} ${to.y}`}
              stroke={palette[index % palette.length]}
              strokeWidth={1 + weight}
              opacity="0.42"
              fill="none"
            />
          ) : (
            <line
              key={`${source}-${target}-${index}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={palette[index % palette.length]}
              strokeWidth={1 + weight}
              opacity="0.45"
            />
          );
        })}
        {nodes.map((node, index) => (
          <g key={node.label}>
            <circle cx={node.x} cy={node.y} r={node.r} fill={palette[index % palette.length]} />
            <text
              x={node.x}
              y={node.y < 76 ? node.y - node.r - 5 : node.y + node.r + 11}
              textAnchor="middle"
            >
              {compactGraphLabel(node.label)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function SankeyChart({ figure, palette }: { figure: PaperFigure; palette: string[] }): JSX.Element {
  const data = figure.data?.kind === "sankey" ? figure.data : fallbackSankey();
  const nodes = sankeyNodePositions(data.nodes, data.links, figure.number);
  return (
    <div className="sankey-chart" style={paletteStyle(palette)}>
      <svg viewBox="0 0 240 150">
        {data.links.slice(0, 16).map((link, index) => {
          const source = nodes[link.source % nodes.length];
          const target = nodes[link.target % nodes.length];
          const middle = (source.x + target.x) / 2;
          return (
            <path
              key={`${link.source}-${link.target}-${index}`}
              d={`M${source.x + 10} ${source.y} C${middle} ${source.y}, ${middle} ${target.y}, ${target.x - 10} ${target.y}`}
              stroke={palette[index % palette.length]}
              strokeWidth={Math.max(2, Math.min(13, link.value))}
              opacity="0.48"
              fill="none"
            />
          );
        })}
        {nodes.map((node, index) => (
          <g key={`${node.label}-${index}`}>
            <rect x={node.x - 9} y={node.y - 15} width="18" height="30" rx="2" fill={palette[index % palette.length]} opacity="0.84" />
            <text x={node.x + (node.x > 170 ? -14 : 14)} y={node.y + 4} textAnchor={node.x > 170 ? "end" : "start"}>
              {shortLabel(node.label)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function graphNodePositions(labels: string[], seed: number): Array<{ label: string; x: number; y: number; r: number }> {
  const layout = seed % 4;
  const count = Math.max(1, labels.length);
  let nodes: Array<{ label: string; x: number; y: number; r: number }>;
  if (layout === 1) {
    nodes = labels.map((label, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      return { label, x: 42 + column * 68 + ((seed + index) % 9), y: 28 + row * 34, r: 7 + ((seed + index) % 4) };
    });
  } else if (layout === 2) {
    nodes = labels.map((label, index) => {
      const cluster = index % 2;
      const local = Math.floor(index / 2);
      const angle = -Math.PI / 2 + (local / Math.ceil(count / 2)) * Math.PI * 2;
      return {
        label,
        x: (cluster === 0 ? 72 : 148) + Math.cos(angle) * 34,
        y: 75 + Math.sin(angle) * 38,
        r: 7 + ((seed + index) % 5)
      };
    });
  } else if (layout === 3) {
    nodes = labels.map((label, index) => ({
      label,
      x: 28 + ((seed * 17 + index * 43) % 166),
      y: 24 + ((seed * 23 + index * 31) % 98),
      r: 6 + ((seed + index) % 6)
    }));
  } else {
    nodes = labels.map((label, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return { label, x: 110 + Math.cos(angle) * 72, y: 76 + Math.sin(angle) * 50, r: 8 + ((seed + index) % 4) };
  });
  }
  return relaxGraphNodes(nodes);
}

function relaxGraphNodes(nodes: Array<{ label: string; x: number; y: number; r: number }>): Array<{ label: string; x: number; y: number; r: number }> {
  const relaxed = nodes.map((node) => ({ ...node }));
  for (let pass = 0; pass < 18; pass += 1) {
    for (let a = 0; a < relaxed.length; a += 1) {
      for (let b = a + 1; b < relaxed.length; b += 1) {
        const first = relaxed[a];
        const second = relaxed[b];
        const dx = second.x - first.x || 0.5;
        const dy = second.y - first.y || 0.5;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minimum = first.r + second.r + 22;
        if (distance >= minimum) continue;
        const push = (minimum - distance) / 2;
        const nx = dx / distance;
        const ny = dy / distance;
        first.x -= nx * push;
        first.y -= ny * push;
        second.x += nx * push;
        second.y += ny * push;
      }
    }
    for (const node of relaxed) {
      node.x = Math.max(24, Math.min(196, node.x));
      node.y = Math.max(24, Math.min(126, node.y));
    }
  }
  return relaxed;
}

function compactGraphLabel(label: string): string {
  if (/[\u4e00-\u9fa5]/.test(label)) return label.length > 4 ? `${label.slice(0, 4)}…` : label;
  return shortLabel(label);
}

function sankeyNodePositions(
  labels: string[],
  links: Array<{ source: number; target: number; value: number }>,
  seed: number
): Array<{ label: string; x: number; y: number }> {
  const layerCount = seed % 3 === 0 ? 4 : 3;
  return labels.map((label, index) => {
    const hasIncoming = links.some((link) => link.target === index);
    const hasOutgoing = links.some((link) => link.source === index);
    const inferredLayer = !hasIncoming ? 0 : !hasOutgoing ? layerCount - 1 : 1 + ((index + seed) % Math.max(1, layerCount - 2));
    const layer = Math.min(layerCount - 1, inferredLayer);
    const peers = labels
      .map((_, peerIndex) => peerIndex)
      .filter((peerIndex) => {
        const peerIncoming = links.some((link) => link.target === peerIndex);
        const peerOutgoing = links.some((link) => link.source === peerIndex);
        const peerLayer = !peerIncoming ? 0 : !peerOutgoing ? layerCount - 1 : 1 + ((peerIndex + seed) % Math.max(1, layerCount - 2));
        return Math.min(layerCount - 1, peerLayer) === layer;
      });
    const peerIndex = Math.max(0, peers.indexOf(index));
    const spacing = 104 / Math.max(1, peers.length);
    return {
      label,
      x: 26 + layer * (188 / Math.max(1, layerCount - 1)),
      y: 24 + spacing / 2 + peerIndex * spacing
    };
  });
}

function fallbackMatrix() {
  const labels = ["A", "B", "C", "D", "E"];
  return { labels, values: labels.map((_, r) => labels.map((__, c) => (r === c ? 1 : ((r * 3 - c * 2) % 9) / 10))) };
}

function fallbackScatter(): Array<{ x: number; y: number; label?: string; size?: number }> {
  return Array.from({ length: 18 }).map((_, index) => ({ x: 8 + index * 4, y: 12 + ((index * 17) % 70), size: index % 4 }));
}

function fallbackGantt() {
  return Array.from({ length: 6 }).map((_, index) => ({ label: `S${index + 1}`, start: index * 7, end: index * 7 + 12 + (index % 3) * 5 }));
}

function fallbackMultiSeries() {
  return {
    labels: ["T1", "T2", "T3", "T4"],
    series: ["A", "B", "C"].map((name, seriesIndex) => ({
      name,
      values: [24, 38, 31, 45].map((value, index) => value + seriesIndex * 7 + index * 3)
    }))
  };
}

function fallbackCandle() {
  return {
    labels: ["1", "2", "3", "4", "5", "6"],
    values: Array.from({ length: 6 }).map((_, index) => ({
      open: 22 + index * 3,
      high: 34 + index * 4,
      low: 16 + index * 2,
      close: 24 + index * 3 + (index % 2 === 0 ? 6 : -4)
    }))
  };
}

function fallbackRadar() {
  return { labels: ["A", "B", "C", "D", "E"], values: [31, 58, 44, 62, 39] };
}

function fallbackNetwork() {
  return { nodes: ["A", "B", "C", "D", "E"], links: [[0, 1, 2], [1, 2, 1], [2, 4, 3], [0, 3, 1], [3, 4, 2]] as Array<[number, number, number]> };
}

function fallbackSankey() {
  return {
    nodes: ["A", "B", "C", "D", "E", "F"],
    links: [
      { source: 0, target: 3, value: 5 },
      { source: 1, target: 4, value: 3 },
      { source: 2, target: 5, value: 4 }
    ]
  };
}
