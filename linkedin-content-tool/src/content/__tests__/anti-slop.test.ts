import { describe, expect, test } from "bun:test";
import { ANTI_SLOP_PHRASES, checkAntiSlop, removeAntiSlop } from "../anti-slop";

describe("anti-slop module", () => {
  test("exports exactly 93 blacklisted phrases", () => {
    expect(ANTI_SLOP_PHRASES).toHaveLength(93);
  });

  test("checkAntiSlop returns empty matches for clean text", () => {
    const result = checkAntiSlop(
      "I enjoy writing concise, natural content for my audience.",
    );
    expect(result.passes).toBe(true);
    expect(result.matches).toHaveLength(0);
  });

  test("checkAntiSlop detects phrases case-insensitively", () => {
    const result = checkAntiSlop("We should Utilize our resources better.");
    expect(result.passes).toBe(false);
    expect(result.matches).toContain("utilize");
  });

  test("checkAntiSlop finds multiple matches", () => {
    const result = checkAntiSlop(
      "Let's leverage this cutting-edge technology to drive growth.",
    );
    expect(result.passes).toBe(false);
    expect(result.matches.length).toBeGreaterThanOrEqual(3);
    expect(result.matches).toContain("leverage");
    expect(result.matches).toContain("cutting-edge");
  });

  test("checkAntiSlop detects all phrase categories", () => {
    const testCases = [
      "we need to talk about the ecosystem",
      "I'm thrilled to announce a paradigm shift",
      "this is a game-changer for the digital landscape",
      "our mission-critical core competency is innovation",
      "let's dive into the low-hanging fruit",
    ];

    for (const text of testCases) {
      const result = checkAntiSlop(text);
      expect(result.passes).toBe(false);
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("removeAntiSlop replaces phrases with natural alternatives", () => {
    const cleaned = removeAntiSlop("We should utilize this technology.");
    expect(cleaned).not.toMatch(/utilize/i);
    expect(cleaned).toMatch(/use/i);
  });

  test("removeAntiSlop preserves clean text", () => {
    const original = "I wrote a clear post about our product launch.";
    const cleaned = removeAntiSlop(original);
    expect(cleaned).toBe(original);
  });

  test("removeAntiSlop handles substring phrases correctly", () => {
    const cleaned = removeAntiSlop("We drive growth with our platform.");
    expect(cleaned).not.toMatch(/drive growth/i);
    expect(cleaned.length).toBeGreaterThan(0);
  });

  test("checkAntiSlop matches exact phrase boundaries", () => {
    const result = checkAntiSlop("Let me delve into this topic.");
    expect(result.passes).toBe(false);
    expect(result.matches).toContain("delve");
  });
});
