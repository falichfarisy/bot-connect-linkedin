export enum TechRole {
  TechLead = "tech_lead",
  SoftwareEngineer = "software_engineer",
  FrontendEngineer = "frontend_engineer",
}

export interface TechRoleConfig {
  keyword: string;
  displayName: string;
  priority: number;
}

export interface SearchProfile {
  name: string;
  headline: string;
  location: string;
  role: TechRole | null;
}

export interface GeoRegion {
  name: string;
  geoId: string;
}

export interface TechRoleOptions {
  techRoleMode: boolean;
  maxPerRole: number;
  geoIds: string[];
}

export const GEO_REGIONS: GeoRegion[] = [
  { name: "United States", geoId: "103644278" },
  { name: "Australia", geoId: "101452733" },
  { name: "Germany", geoId: "101282230" },
  { name: "United Kingdom", geoId: "102299470" },
  { name: "Spain", geoId: "105646813" },
  { name: "Italy", geoId: "103350119" },
  { name: "Sweden", geoId: "105117694" },
  { name: "France", geoId: "105015875" },
  { name: "Belgium", geoId: "100565514" },
  { name: "Netherlands", geoId: "102890719" },
  { name: "Switzerland", geoId: "106693272" },
];

export const GEO_IDS: string[] = GEO_REGIONS.map((r) => r.geoId);

export const ROLE_CONFIGS: TechRoleConfig[] = [
  {
    keyword: "Tech Lead",
    displayName: "Tech Lead",
    priority: 1,
  },
  {
    keyword: "Software Engineer",
    displayName: "Software Engineer",
    priority: 2,
  },
  {
    keyword: "Frontend Engineer",
    displayName: "Frontend Engineer",
    priority: 3,
  },
];
