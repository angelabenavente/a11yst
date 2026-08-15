import { describe, expect, it } from "vitest";
import {
  hasSignificantHorizontalOverflow,
  intersects,
  overlapPercent,
  type Rect,
} from "@a11yst/rules";

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

describe("geometry helpers", () => {
  describe("intersects", () => {
    it("returns true when rectangles overlap", () => {
      expect(intersects(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true);
    });

    it("returns false when rectangles are separated", () => {
      expect(intersects(rect(0, 0, 10, 10), rect(20, 20, 10, 10))).toBe(false);
    });

    it("returns false when rectangles only touch on an edge", () => {
      expect(intersects(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false);
    });
  });

  describe("overlapPercent", () => {
    it("returns 100 when one rectangle fully contains the other", () => {
      expect(overlapPercent(rect(0, 0, 20, 20), rect(5, 5, 5, 5))).toBe(100);
    });

    it("returns 0 when rectangles do not overlap", () => {
      expect(overlapPercent(rect(0, 0, 10, 10), rect(50, 50, 10, 10))).toBe(0);
    });

    it("returns the overlap ratio relative to the smaller rectangle", () => {
      // 5×10 overlap area = 50; smaller rect area = 10×10 = 100 → 50%
      expect(overlapPercent(rect(0, 0, 10, 10), rect(5, 0, 10, 10))).toBe(50);
    });
  });

  describe("hasSignificantHorizontalOverflow", () => {
    it("returns false when scroll and client widths match within tolerance", () => {
      expect(hasSignificantHorizontalOverflow(800, 800, 8)).toBe(false);
      expect(hasSignificantHorizontalOverflow(805, 800, 8)).toBe(false);
    });

    it("returns true when horizontal overflow exceeds the tolerance", () => {
      expect(hasSignificantHorizontalOverflow(900, 800, 8)).toBe(true);
    });
  });
});
