import {describe, expect, test} from "vitest";

import {createDisplayLabelMap, getDisplayLabel} from "@/services/DisplayLabelProtocol";

describe("display-label protocol", () => {
  test("keeps stable language identifiers separate from canonical names", () => {
    const labels = createDisplayLabelMap(
      ["eng", "fra", "deu", "nld"],
      ["English", "French", "German, Standard (1901)", "Dutch"],
    );

    expect([...labels.entries()]).toEqual([
      ["eng", "English"],
      ["fra", "French"],
      ["deu", "German, Standard (1901)"],
      ["nld", "Dutch"],
    ]);
    expect(getDisplayLabel(labels, "eng")).toBe("English");
    expect(getDisplayLabel(labels, "unknown-id")).toBe("unknown-id");
  });

  test("fails fast when positional labels cannot be matched safely", () => {
    expect(() => createDisplayLabelMap(["eng", "fra"], ["English"]))
      .toThrow("Display labels must match the number of object identifiers");
    expect(() => createDisplayLabelMap(["eng", "eng"], ["English", "English"]))
      .toThrow('Object identifier "eng" is duplicated');
    expect(() => createDisplayLabelMap(["eng"], [" "]))
      .toThrow('Display label for "eng" is empty');
  });
});
