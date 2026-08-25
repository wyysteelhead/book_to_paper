import type { PaperFigure } from "../../../common/types";
import { pickFigurePalette } from "./palettes";
import { resolveChartTemplate } from "./chartRegistry";

export function ChartRenderer({ figure }: { figure: PaperFigure }): JSX.Element {
  const isChinese = figure.caption.startsWith("图 ");
  const palette = pickFigurePalette(figure);

  if (figure.customRenderer?.language === "html") {
    return <CustomHtmlFigure code={figure.customRenderer.code} />;
  }

  const Template = resolveChartTemplate({ figure, isChinese, palette });
  return <Template figure={figure} isChinese={isChinese} palette={palette} />;
}

function CustomHtmlFigure({ code }: { code: string }): JSX.Element {
  const source = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: #fffefa;
    color: #1f1f1d;
    font-family: Inter, "Times New Roman", "Songti SC", serif;
  }
  * { box-sizing: border-box; }
</style>
</head>
<body>${code}</body>
</html>`;

  return (
    <iframe
      className="custom-code-chart"
      sandbox=""
      srcDoc={source}
      title="Custom figure"
    />
  );
}
