import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { execute, queryOne } from "@/lib/db";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEYLEN = 64;

interface AuthUserRow {
  id: string;
  email: string;
  password_hash: string;
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function ensureAuthUsersTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS serpmap_users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS serpmap_users_email_lower_uniq
      ON serpmap_users (lower(email));
  `);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export async function findAuthUserByEmail(email: string): Promise<AuthUserRow | null> {
  return queryOne<AuthUserRow>(
    `SELECT id::text, email, password_hash
       FROM serpmap_users
      WHERE lower(email) = lower($1)
      LIMIT 1`,
    [email]
  );
}

export async function createAuthUser(email: string, password: string): Promise<"created" | "exists"> {
  const passwordHash = await hashPassword(password);
  const inserted = await queryOne<{ id: string }>(
    `INSERT INTO serpmap_users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT ((lower(email))) DO NOTHING
     RETURNING id::text`,
    [email, passwordHash]
  );
  return inserted ? "created" : "exists";
}
