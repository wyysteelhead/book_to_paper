import type { PaperFigure } from "../../../../common/types";
import { paletteStyle } from "../palettes";

export function FlowChart({
  figure,
  isChinese,
  palette
}: {
  figure?: PaperFigure;
  isChinese: boolean;
  palette: string[];
}): JSX.Element {
  const data = figure?.data?.kind === "flow" ? figure.data : fallbackFlow(isChinese, figure?.number ?? 0);
  if (data.variant === "decision") {
    return <DecisionFlow nodes={data.nodes} links={data.links} palette={palette} />;
  }
  if (data.variant === "swimlane") {
    return <SwimlaneFlow nodes={data.nodes} palette={palette} />;
  }
  return (
    <div className="flow-chart flow-pipeline" style={paletteStyle(palette)}>
      {data.nodes.slice(0, 7).map((node, index) => (
        <span key={`${node}-${index}`} style={{ borderColor: palette[index % palette.length] }}>
          {node}
        </span>
      ))}
    </div>
  );
}

function DecisionFlow({
  nodes,
  links,
  palette
}: {
  nodes: string[];
  links: Array<[number, number]>;
  palette: string[];
}): JSX.Element {
  const positions = nodes.map((_, index) => {
    if (index === 0) return { x: 110, y: 24 };
    if (index === nodes.length - 1) return { x: 110, y: 126 };
    return { x: 45 + ((index - 1) % 3) * 65, y: 72 };
  });
  return (
    <div className="flow-chart flow-decision" style={paletteStyle(palette)}>
      <svg viewBox="0 0 220 150">
        {links.map(([source, target], index) => (
          <path
            key={`${source}-${target}-${index}`}
            d={`M${positions[source].x} ${positions[source].y + 12} C${positions[source].x} 82, ${positions[target].x} 68, ${positions[target].x} ${positions[target].y - 12}`}
            stroke={palette[index % palette.length]}
            fill="none"
          />
        ))}
        {nodes.map((node, index) => (
          <g key={`${node}-${index}`}>
            <rect
              x={positions[index].x - 28}
              y={positions[index].y - 12}
              width="56"
              height="24"
              rx={index === 0 || index === nodes.length - 1 ? 3 : 0}
              transform={index > 0 && index < nodes.length - 1 ? `rotate(45 ${positions[index].x} ${positions[index].y})` : undefined}
              fill="#fffefa"
              stroke={palette[index % palette.length]}
            />
            <text x={positions[index].x} y={positions[index].y + 4} textAnchor="middle">
              {node}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SwimlaneFlow({ nodes, palette }: { nodes: string[]; palette: string[] }): JSX.Element {
  return (
    <div className="flow-chart flow-swimlane" style={paletteStyle(palette)}>
      {[0, 1].map((lane) => (
        <div key={lane} className="flow-lane">
          {nodes
            .filter((_, index) => index % 2 === lane)
            .map((node, index) => (
              <span key={`${node}-${index}`} style={{ borderColor: palette[(index + lane) % palette.length] }}>
                {node}
              </span>
            ))}
        </div>
      ))}
    </div>
  );
}

function fallbackFlow(isChinese: boolean, seed: number): { nodes: string[]; links: Array<[number, number]>; variant: "pipeline" | "decision" | "swimlane" } {
  const terms = isChinese
    ? ["假设层", "归一化", "门控", "采样", "扰动", "聚合", "校准"]
    : ["Hypothesis", "Normalize", "Gate", "Sample", "Perturb", "Aggregate", "Calibrate"];
  const nodes = terms.slice(seed % 2, 6 + (seed % 2));
  return {
    nodes,
    links: nodes.flatMap((_, index) => (index < nodes.length - 1 ? ([[index, index + 1]] as Array<[number, number]>) : [])),
    variant: (["pipeline", "decision", "swimlane"] as const)[seed % 3]
  };
}
