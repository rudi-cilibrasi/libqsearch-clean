import {describe, expect, test} from "vitest";
import {getTreeInput} from "@/functions/qtree";

describe("QSearch matrix serialization", () => {
  test("uses unique positional leaf identifiers", () => {
    const result = getTreeInput({
      labels: ["Same.Label", "Same/Label"],
      ncdMatrix: [[0, 0.3], [0.3, 0]],
    });
    expect(result).toBe("leaf_0 0 0.3\nleaf_1 0.3 0\n");
  });

  test("preserves the shortest round-trippable matrix precision", () => {
    const result = getTreeInput({
      labels: ["A", "B"],
      ncdMatrix: [[0, 0.3333333333333333], [0.3333333333333333, 0]],
    });
    expect(result).toContain("0.3333333333333333");
  });

  test("returns an empty input for empty data", () => {
    expect(getTreeInput({labels: [], ncdMatrix: []})).toBe("");
  });

  test("fails fast on shape and numeric corruption", () => {
    expect(() => getTreeInput({labels: ["A", "B"], ncdMatrix: [[0], [0, 0]]}))
      .toThrow("row 0");
    expect(() => getTreeInput({
      labels: ["A", "B"],
      ncdMatrix: [[0, Number.NaN], [0, 0]],
    })).toThrow("invalid matrix value");
  });
});
