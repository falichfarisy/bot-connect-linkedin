export enum TechRole {
  TechLead = "tech_lead",
  SoftwareEngineer = "software_engineer",
  FrontendEngineer = "frontend_engineer",
}

export interface TechRoleConfig {
  keyword: string;
  displayName: string;
  priority: number;
  max: number;
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
