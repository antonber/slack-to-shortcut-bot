import { describe, it, expect } from "vitest";
import { parseShortcutRefs } from "../github/reads.js";

describe("parseShortcutRefs", () => {
  it("extracts bracketed shortcut ref", () => {
    expect(parseShortcutRefs("[sc-1234]")).toEqual([1234]);
  });

  it("extracts multiple refs", () => {
    expect(parseShortcutRefs("sc-1234 and sc-5678")).toEqual([1234, 5678]);
  });

  it("handles uppercase SC", () => {
    expect(parseShortcutRefs("SC-42")).toEqual([42]);
  });

  it("returns empty array when no refs", () => {
    expect(parseShortcutRefs("just a normal PR title")).toEqual([]);
  });

  it("deduplicates refs", () => {
    expect(parseShortcutRefs("[sc-1234] relates to sc-1234")).toEqual([1234]);
  });

  it("handles mixed formats in one string", () => {
    const result = parseShortcutRefs("Fix [sc-100] and SC-200 (see sc-300)");
    expect(result).toEqual([100, 200, 300]);
  });
});
