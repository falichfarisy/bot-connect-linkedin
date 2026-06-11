import { ANTI_SLOP_PHRASES } from "./anti-slop-list";
export { ANTI_SLOP_PHRASES };

/**
 * Natural replacements for blacklisted phrases.
 * Used by removeAntiSlop to replace instead of just deleting.
 */
const REPLACEMENTS: Record<string, string> = {
  delve: "explore",
  utilize: "use",
  leverage: "use",
  facilitate: "help",
  elucidate: "explain",
  testament: "proof",
  synergy: "collaboration",
  "game-changer": "breakthrough",
  "excited to announce": "announcing",
  thrilled: "happy",
  "it's worth noting": "",
  "in today's": "in",
  landscape: "world",
  navigate: "manage",
  moreover: "",
  furthermore: "",
  "a myriad of": "many",
  "in the realm of": "in",
  "rapidly evolving": "changing",
  "ever-evolving": "changing",
  "digital landscape": "digital world",
  revolutionize: "transform",
  transformative: "transforming",
  "cutting-edge": "advanced",
  "state-of-the-art": "modern",
  "world-class": "excellent",
  "best-in-class": "leading",
  "industry-leading": "leading",
  unprecedented: "remarkable",
  groundbreaking: "pioneering",
  "paradigm shift": "major change",
  "thought leadership": "expertise",
  "thought leader": "expert",
  "let's dive": "let's start",
  "dive into": "explore",
  "diving into": "exploring",
  unpack: "explain",
  "we need to talk about": "let's discuss",
  "the truth about": "about",
  "the reality is": "",
  "here's the thing": "",
  "let's be honest": "",
  "it's time to": "",
  "I wanted to share": "I'm sharing",
  "I'm excited to share": "I'm sharing",
  "excited to share": "sharing",
  "I'm thrilled to": "I'm happy to",
  humbled: "grateful",
  "grateful for the opportunity": "thankful",
  "it's with great": "",
  "pleasure to announce": "announcing",
  "proud to announce": "announcing",
  ecosystem: "platform",
  holistic: "comprehensive",
  "actionable insights": "practical tips",
  "data-driven": "data-informed",
  "results-driven": "outcome-focused",
  impactful: "effective",
  meaningful: "valuable",
  scalable: "expandable",
  robust: "reliable",
  streamline: "simplify",
  optimize: "improve",
  supercharge: "boost",
  unlock: "enable",
  unleash: "release",
  harness: "use",
  drive: "achieve",
  "drive growth": "grow",
  "drive results": "deliver results",
  "proven track record": "experience",
  proven: "tested",
  "award-winning": "awarded",
  "top-notch": "great",
  "next-generation": "modern",
  disrupt: "change",
  disruption: "change",
  disruptive: "transformative",
  innovation: "new ideas",
  innovative: "fresh",
  "mission-critical": "essential",
  "core competency": "core strength",
  "low-hanging fruit": "easy wins",
  "move the needle": "make progress",
  "deep dive": "detailed review",
  takeaway: "key point",
  "in summary": "in short",
  "to summarize": "in short",
  "in conclusion": "",
  "in closing": "",
  "hope this helps": "",
  "hope this was helpful": "",
  "feel free to reach out": "",
};

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check text against the anti-slop blacklist.
 * Case-insensitive matching — returns every blacklisted phrase found.
 */
export function checkAntiSlop(
  text: string,
): { passes: boolean; matches: string[] } {
  const lower = text.toLowerCase();
  const matches: string[] = [];

  for (const phrase of ANTI_SLOP_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      matches.push(phrase);
    }
  }

  return { passes: matches.length === 0, matches };
}

/**
 * Remove / replace blacklisted phrases from text.
 *
 * Longer phrases are matched first so that e.g. "drive growth" is
 * caught before the shorter "drive" fires.
 */
export function removeAntiSlop(text: string): string {
  // Sort phrases longest-first to handle substrings correctly
  const sorted = [...ANTI_SLOP_PHRASES].sort(
    (a, b) => b.length - a.length,
  );

  let result = text;

  for (const phrase of sorted) {
    const replacement = REPLACEMENTS[phrase] ?? "";
    const regex = new RegExp(escapeRegex(phrase), "gi");
    result = result.replace(regex, replacement);
  }

  return result;
}
