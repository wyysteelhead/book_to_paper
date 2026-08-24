import type { PaperFigure } from "../../../../common/types";
import { paletteStyle } from "../palettes";
import { SeriesChart } from "./SeriesChart";

export function TeaserDashboard({
  figure,
  palette,
  isChinese
}: {
  figure: PaperFigure;
  palette: string[];
  isChinese: boolean;
}): JSX.Element {
  const labels =
    figure.data?.kind === "series"
      ? figure.data.labels.slice(0, 6)
      : isChinese
        ? ["起点", "铺陈", "转折", "聚合", "释放", "回收"]
        : ["Start", "Setup", "Shift", "Merge", "Release", "Return"];
  const values =
    figure.data?.kind === "series"
      ? figure.data.values.slice(0, 6)
      : [34, 58, 47, 72, 63, 81];

  return (
    <div className="teaser-dashboard" style={paletteStyle(palette)}>
      <div className="teaser-flow">
        {(isChinese ? ["导入文本", "章节重构", "信号抽取", "论文视图"] : ["Source", "Sections", "Signals", "Paper View"]).map(
          (label, index) => (
            <span key={label} style={{ borderColor: palette[index % palette.length] }}>
              {label}
            </span>
          )
        )}
      </div>
      <SeriesChart labels={labels} values={values} palette={palette} variant="area" />
      <div className="teaser-matrix">
        {Array.from({ length: 24 }).map((_, index) => (
          <span
            key={index}
            style={{
              background: `color-mix(in srgb, ${palette[index % palette.length]} ${32 + ((index * 11) % 48)}%, #fffefa)`
            }}
          />
        ))}
      </div>
      <div className="teaser-summary">
        <strong>{isChinese ? "结构密度" : "Density"}</strong>
        <span>{Math.max(...values).toLocaleString()}</span>
        <strong>{isChinese ? "阶段数" : "Stages"}</strong>
        <span>{labels.length}</span>
      </div>
    </div>
  );
}
