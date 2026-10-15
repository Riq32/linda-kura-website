import "next-auth";
import type { DefaultSession } from "next-auth";

export interface AgentUserProfile {
  id: string;
  username: string;
  name?: string;
  access_code: string;
  county: string;
  constituency: string;
  ward: string;
  polling_station: string;
}

declare module "next-auth" {
  interface User {
    id: string;
    accessToken?: string;
    refreshToken?: string;
    agentProfile?: AgentUserProfile;
  }

  interface Session {
    accessToken?: string;
    refreshToken?: string;
    user: {
      id: string;
      agentProfile?: AgentUserProfile;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    agentProfile?: AgentUserProfile;
  }
}
