import { describe, expect, it } from "vitest";
import { calcMargin } from "./margin";

describe("calcMargin", () => {
  it("returns sell minus cost", () => {
    expect(calcMargin(10000, 13500)).toBe(3500);
  });

  it("returns zero when sell equals cost", () => {
    expect(calcMargin(8000, 8000)).toBe(0);
  });

  it("returns a negative margin on a loss-making price", () => {
    expect(calcMargin(12000, 11500)).toBe(-500);
  });

  it("rounds to two decimal places", () => {
    expect(calcMargin(49.995, 99.99)).toBe(50);
  });
});
