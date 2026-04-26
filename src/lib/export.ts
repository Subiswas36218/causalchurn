import { toPng } from "html-to-image";

/** Trigger a browser download for a string blob. */
export function downloadString(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

/** Escape a single CSV cell value. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Convert a 2D array of cells to a CSV string. */
export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/**
 * Snapshot a DOM node as a PNG and trigger download. Resolves the popover
 * background to keep tooltips/legends readable on both themes.
 */
export async function downloadNodeAsPng(node: HTMLElement, filename: string) {
  const styles = getComputedStyle(document.documentElement);
  const bg = `hsl(${styles.getPropertyValue("--background").trim() || "0 0% 100%"})`;
  const dataUrl = await toPng(node, {
    backgroundColor: bg,
    pixelRatio: 2,
    cacheBust: true,
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
