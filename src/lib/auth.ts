import type { NextAuthOptions } from "next-auth";

/** Authentication is scaffolded but has no provider until the admin flow is implemented. */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [],
  pages: { signIn: "/admin/login" }
};
