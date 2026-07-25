import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db, users, emailAccounts, DEFAULT_PREFERENCES } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: GMAIL_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return false;

      // Upsert the user record.
      const [dbUser] = await db
        .insert(users)
        .values({
          email: user.email,
          name: user.name,
          image: user.image,
          preferences: DEFAULT_PREFERENCES,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: { name: user.name, image: user.image },
        })
        .returning();

      // Persist the (encrypted) refresh token when Google returns one.
      if (account.refresh_token) {
        await db
          .insert(emailAccounts)
          .values({
            userId: dbUser.id,
            provider: "gmail",
            email: user.email,
            refreshTokenEnc: encryptSecret(account.refresh_token),
            status: "active",
          })
          .onConflictDoUpdate({
            target: [emailAccounts.userId, emailAccounts.email],
            set: {
              refreshTokenEnc: encryptSecret(account.refresh_token),
              status: "active",
              lastError: null,
            },
          });
      }
      return true;
    },
    async jwt({ token }) {
      if (token.email && !token.userId) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, token.email),
        });
        if (dbUser) token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
});

/** Returns the current user's DB id or throws (for use in server actions / route handlers). */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}
