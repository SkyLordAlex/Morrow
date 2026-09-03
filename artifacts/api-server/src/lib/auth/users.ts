import { and, eq } from "drizzle-orm";
import {
  type AuthProvider,
  type User,
  type UserRole,
  db,
  identitiesTable,
  usersTable,
} from "@workspace/db";
import { hashPassword } from "./password.js";
import type { VerifiedIdentity } from "./providers.js";

export interface PublicUser {
  id: number;
  email: string;
  displayName: string | null;
  role: UserRole;
  hasPassword: boolean;
  providers: AuthProvider[];
}

/** The client-facing user shape, including how the account can sign in. */
export async function toPublicUser(user: User): Promise<PublicUser> {
  const identities = await db
    .select({ provider: identitiesTable.provider })
    .from(identitiesTable)
    .where(eq(identitiesTable.userId, user.id));

  const providers = identities
    .map((row) => row.provider)
    .filter((p): p is AuthProvider => p === "apple" || p === "google")
    .sort();

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    role: user.role === "admin" ? "admin" : "user",
    hasPassword: Boolean(user.passwordHash),
    providers: [...new Set(providers)],
  };
}

function adminEmails(): string[] {
  return (process.env["ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Grant admin to any account whose email is listed in ADMIN_EMAILS. Only ever
 * upgrades — demotion is done deliberately through the admin API, so a typo in
 * the env var can't silently strip someone's access.
 */
export async function ensureAdminForEmail(user: User): Promise<User> {
  if (user.role === "admin") return user;
  if (!adminEmails().includes(user.email)) return user;
  const [updated] = await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, user.id))
    .returning();
  return updated ?? user;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserById(id: number): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  return user;
}

export async function findUserByEmail(
  email: string,
): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizeEmail(email)))
    .limit(1);
  return user;
}

export async function createUserWithPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const [user] = await db
    .insert(usersTable)
    .values({
      email: normalizeEmail(email),
      passwordHash: await hashPassword(password),
      displayName: displayName?.trim() || null,
    })
    .returning();
  return user;
}

/**
 * Resolve a verified Apple/Google identity to a local account:
 *   1. known (provider, subject) → that user
 *   2. same email already registered → link this identity to it
 *   3. otherwise → create a passwordless account and link the identity
 */
export async function findOrCreateUserByIdentity(
  provider: AuthProvider,
  identity: VerifiedIdentity,
): Promise<User> {
  const [existingIdentity] = await db
    .select()
    .from(identitiesTable)
    .where(
      and(
        eq(identitiesTable.provider, provider),
        eq(identitiesTable.subject, identity.subject),
      ),
    )
    .limit(1);

  if (existingIdentity) {
    const user = await findUserById(existingIdentity.userId);
    if (user) return user;
  }

  const email = normalizeEmail(identity.email);
  let user = await findUserByEmail(email);

  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email, passwordHash: null, displayName: null })
      .returning();
  }

  if (!existingIdentity) {
    await db
      .insert(identitiesTable)
      .values({ userId: user.id, provider, subject: identity.subject });
  }

  return user;
}
