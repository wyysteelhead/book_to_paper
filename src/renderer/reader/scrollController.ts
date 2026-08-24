import type { PageRole, PaperDocument, PaperPage } from "../../common/types";

const roleBonus: Partial<Record<PageRole, number>> = {
  teaser: 0.3,
  figure: 0.25,
  table: 0.2,
  formula: 0.18,
  references: 0.12,
  abstract: 0.08
};

export function selectAcademicTarget(
  document: PaperDocument,
  currentPageIndex: number
): PaperPage {
  return [...document.pages]
    .map((page) => {
      const distance = Math.abs(page.index - currentPageIndex);
      const distancePenalty = Math.min(0.34, distance * 0.035);
      const targetScore = page.workScore + (roleBonus[page.role] ?? 0) - distancePenalty;
      return { page, targetScore };
    })
    .sort((a, b) => b.targetScore - a.targetScore)[0].page;
}

export function scrollToPage(pageId: string): void {
  const node = document.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`);
  node?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function findCurrentPageIndex(): number {
  const pages = [...document.querySelectorAll<HTMLElement>("[data-page-index]")];
  const viewportCenter = window.innerHeight / 2;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const page of pages) {
    const rect = page.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = Number(page.dataset.pageIndex ?? 0);
    }
  }

  return bestIndex;
}
