import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AgentUserProfile } from "@/types/next-auth";

const MOCK_AGENTS: Record<string, AgentUserProfile> = {
  "LK-36QW": {
    id: "1",
    username: "admin",
    name: "Mombasa Field Agent",
    access_code: "LK-36QW",
    county: "MOMBASA County",
    constituency: "CHANGAMWE Constituency",
    ward: "PORT REITZ",
    polling_station: "Hope Internet"
  },
  "LK-7KQ2": {
    id: "2",
    username: "agent_nairobi",
    name: "Nairobi Central Agent",
    access_code: "LK-7KQ2",
    county: "NAIROBI County",
    constituency: "STAREHE Constituency",
    ward: "CENTRAL",
    polling_station: "Nairobi Primary School Stn 1"
  }
};

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET || "linda-kura-election-tracker-secret-jwt-key-2026",
  providers: [
    CredentialsProvider({
      id: "agent-code",
      name: "Agent Code",
      credentials: {
        code: { label: "Agent Code", type: "text", placeholder: "e.g. LK-36QW" }
      },
      async authorize(credentials) {
        if (!credentials?.code) {
          throw new Error("Please enter your Agent Access Code");
        }

        const cleanCode = credentials.code.trim().toUpperCase();
        const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

        try {
          // Attempt authentication with the real backend API
          const response = await fetch(`${apiUrl}/api/auth/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ code: cleanCode })
          });

          if (response.ok) {
            const data = await response.json();
            return {
              id: String(data.user?.id || cleanCode),
              name: data.user?.name || data.user?.username || `Agent (${cleanCode})`,
              email: `${cleanCode.toLowerCase()}@lindakura.org`,
              accessToken: data.access,
              refreshToken: data.refresh,
              agentProfile: data.user
            };
          }
        } catch {
          // If backend is offline, check mock agent codes
        }

        // Fallback for known sample credentials or dynamic agent codes for seamless testing
        if (MOCK_AGENTS[cleanCode]) {
          const profile = MOCK_AGENTS[cleanCode];
          return {
            id: profile.id,
            name: profile.name || `Agent ${cleanCode}`,
            email: `${cleanCode.toLowerCase()}@lindakura.org`,
            accessToken: `mock_jwt_access_${cleanCode}_${Date.now()}`,
            refreshToken: `mock_jwt_refresh_${cleanCode}_${Date.now()}`,
            agentProfile: profile
          };
        }

        // Allow any standard LK-XXXX formatted code in demo mode
        if (cleanCode.startsWith("LK-") && cleanCode.length >= 6) {
          const profile: AgentUserProfile = {
            id: String(Math.floor(Math.random() * 1000) + 10),
            username: `agent_${cleanCode.replace(/[^A-Z0-9]/g, "").toLowerCase()}`,
            name: `Electoral Agent (${cleanCode})`,
            access_code: cleanCode,
            county: "NAIROBI County",
            constituency: "WESTLANDS Constituency",
            ward: "PARKLANDS",
            polling_station: "Highridge Primary Stn 1"
          };
          return {
            id: profile.id,
            name: profile.name,
            email: `${cleanCode.toLowerCase()}@lindakura.org`,
            accessToken: `mock_jwt_access_${cleanCode}_${Date.now()}`,
            refreshToken: `mock_jwt_refresh_${cleanCode}_${Date.now()}`,
            agentProfile: profile
          };
        }

        throw new Error("Invalid agent code. Please verify your credentials.");
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.agentProfile = user.agentProfile;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        if (session.user) {
          session.user.id = token.sub || (token.agentProfile?.id ?? "1");
          session.user.agentProfile = token.agentProfile;
        }
      }
      return session;
    }
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login"
  }
};
