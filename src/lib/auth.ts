import type { NextAuthOptions } from "next-auth";

/** Authentication  */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [],
  pages: { signIn: "/admin/login" }
};
