import type { BoundingBox } from "@a11yst/types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function toRect(box: BoundingBox): Rect {
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

export function rectArea(rect: Rect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function intersection(a: Rect, b: Rect): Rect | undefined {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  if (width <= 0 || height <= 0) return undefined;
  return { x, y, width, height };
}

export function overlapPercent(a: Rect, b: Rect): number {
  const overlap = intersection(a, b);
  if (!overlap) return 0;
  const smaller = Math.min(rectArea(a), rectArea(b));
  if (smaller <= 0) return 0;
  return (rectArea(overlap) / smaller) * 100;
}

export function isInViewport(rect: Rect, viewportWidth: number, viewportHeight: number): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width > 0 &&
    rect.y + rect.height > 0 &&
    rect.x < viewportWidth &&
    rect.y < viewportHeight
  );
}

export function hasSignificantHorizontalOverflow(
  scrollWidth: number,
  clientWidth: number,
  tolerancePx: number,
): boolean {
  return scrollWidth - clientWidth > tolerancePx;
}

export function rectsOverlapSignificantly(
  a: Rect,
  b: Rect,
  tolerancePercent: number,
): boolean {
  return overlapPercent(a, b) >= tolerancePercent;
}
