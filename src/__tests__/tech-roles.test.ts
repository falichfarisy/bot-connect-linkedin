import { describe, expect, test } from "bun:test";
import { TechRole, ROLE_CONFIGS, GEO_IDS, GEO_REGIONS } from "../types.ts";
import { buildSearchUrl } from "../search.ts";
import { detectTechRole, sortByPriority } from "../connect.ts";

describe("GEO_IDS", () => {
  test("has exactly 11 regions", () => {
    expect(GEO_IDS.length).toBe(11);
  });

  test("includes USA, Australia, and European countries", () => {
    const names = GEO_REGIONS.map((r) => r.name);
    expect(names).toContain("United States");
    expect(names).toContain("Australia");
    expect(names).toContain("Germany");
    expect(names).toContain("United Kingdom");
  });

  test("all geo IDs are non-empty strings", () => {
    for (const id of GEO_IDS) {
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    }
  });
});

describe("ROLE_CONFIGS", () => {
  test("has exactly 3 roles", () => {
    expect(ROLE_CONFIGS.length).toBe(3);
  });

  test("ordered by priority: Tech Lead first", () => {
    expect(ROLE_CONFIGS[0]!.keyword).toBe("Tech Lead");
    expect(ROLE_CONFIGS[1]!.keyword).toBe("Software Engineer");
    expect(ROLE_CONFIGS[2]!.keyword).toBe("Frontend Engineer");
  });

  test("priorities are 1, 2, 3", () => {
    expect(ROLE_CONFIGS[0]!.priority).toBe(1);
    expect(ROLE_CONFIGS[1]!.priority).toBe(2);
    expect(ROLE_CONFIGS[2]!.priority).toBe(3);
  });
});

describe("TechRole", () => {
  test("has all three tech roles", () => {
    expect(TechRole.TechLead as string).toBe("tech_lead");
    expect(TechRole.SoftwareEngineer as string).toBe("software_engineer");
    expect(TechRole.FrontendEngineer as string).toBe("frontend_engineer");
  });
});

describe("buildSearchUrl", () => {
  test("includes keyword in URL", () => {
    const url = buildSearchUrl("Tech Lead", ["103644278"], 1);
    expect(url).toContain("keywords=Tech%20Lead");
  });

  test("encodes geo IDs as JSON array in geoUrn parameter", () => {
    const url = buildSearchUrl("Engineer", ["103644278", "101452733"], 1);
    expect(url).toContain("geoUrn=");
    expect(url).toContain("%5B");
    expect(url).toContain("%5D");
    expect(url).toContain("103644278");
    expect(url).toContain("101452733");
  });

  test("includes page number", () => {
    const url = buildSearchUrl("Engineer", ["103644278"], 3);
    expect(url).toContain("page=3");
  });

  test("defaults to page 1 when page not specified", () => {
    const url = buildSearchUrl("Engineer", ["103644278"]);
    expect(url).toContain("page=1");
  });

  test("defaults to global GEO_IDS when geoIds not specified", () => {
    const url = buildSearchUrl("Engineer");
    expect(url).toContain("103644278");
    expect(url).toContain("101452733");
  });
});

describe("detectTechRole", () => {
  test.each([
    ["Senior Tech Lead at Google", TechRole.TechLead],
    ["Technical Lead at Meta", TechRole.TechLead],
    ["Lead Engineer at Netflix", TechRole.TechLead],
    ["Engineering Manager at Amazon", TechRole.TechLead],
    ["Software Engineer II at Google", TechRole.SoftwareEngineer],
    ["Software Developer at Startup", TechRole.SoftwareEngineer],
    ["Backend Engineer at Co", TechRole.SoftwareEngineer],
    ["Full Stack Developer at Corp", TechRole.SoftwareEngineer],
    ["Frontend Engineer at Apple", TechRole.FrontendEngineer],
    ["Front-end Developer at WebCo", TechRole.FrontendEngineer],
    ["React Developer at AppCo", TechRole.FrontendEngineer],
    ["UI Engineer at DesignCo", TechRole.FrontendEngineer],
  ])('detects "%s" as %s', (headline, expected) => {
    expect(detectTechRole(headline as string)).toBe(expected);
  });

  test.each([
    ["HR Manager"],
    ["Recruiter at Tech Co"],
    ["Data Scientist"],
    ["Product Manager"],
  ])('returns null for non-tech role "%s"', (headline) => {
    expect(detectTechRole(headline as string)).toBeNull();
  });
});

describe("sortByPriority", () => {
  test("sorts Tech Lead first, then SE, then FE, then null", () => {
    const profiles = [
      { name: "FE", headline: "", location: "", role: TechRole.FrontendEngineer },
      { name: "SE", headline: "", location: "", role: TechRole.SoftwareEngineer },
      { name: "TL", headline: "", location: "", role: TechRole.TechLead },
      { name: "NA", headline: "", location: "", role: null },
    ];
    const sorted = sortByPriority(profiles);
    expect(sorted[0]!.name).toBe("TL");
    expect(sorted[1]!.name).toBe("SE");
    expect(sorted[2]!.name).toBe("FE");
    expect(sorted[3]!.name).toBe("NA");
  });

  test("does not mutate original array", () => {
    const profiles = [
      { name: "B", headline: "", location: "", role: TechRole.SoftwareEngineer },
      { name: "A", headline: "", location: "", role: TechRole.TechLead },
    ];
    const sorted = sortByPriority(profiles);
    expect(sorted[0]!.name).toBe("A");
    expect(profiles[0]!.name).toBe("B");
  });
});
