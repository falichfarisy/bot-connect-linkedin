import type { TechRoleConfig } from "../types/roles.ts";

export const ROLE_CONFIGS: TechRoleConfig[] = [
  {
    keyword: "Tech Lead",
    displayName: "Tech Lead",
    priority: 1,
    max: 15,
  },
  {
    keyword: "Software Engineer",
    displayName: "Software Engineer",
    priority: 2,
    max: 15,
  },
  {
    keyword: "Frontend Engineer",
    displayName: "Frontend Engineer",
    priority: 3,
    max: 10,
  },
];
