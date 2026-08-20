import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { getAdminsCollection } from "./mongodb.js";

/**
 * Admin accounts. One document per admin in the `admins` collection, password
 * stored as a scrypt hash — never in plaintext, and never in a cookie.
 *
 * The first admin is seeded from ADMIN_EMAIL / ADMIN_PASSWORD on the first
 * sign-in attempt. Seeding only ever *creates*: once the document exists the
 * database is authoritative, so changing the password in the app is not undone
 * by a stale value still sitting in `.env.local`.
 */

const scrypt = promisify(scryptCallback);

// Cost parameters are stored alongside the hash, so raising them later still
// leaves every existing password verifiable.
const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64 };
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 10;

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, SCRYPT.keyLength, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function passwordMatches(password, stored) {
  const [scheme, N, r, p, saltHex, keyHex] = String(stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });

  return timingSafeEqual(actual, expected);
}

/**
 * A throwaway hash with the same cost as a real one. Verifying against it when
 * the email is unknown keeps a wrong email as slow as a wrong password, so the
 * response time does not reveal which admin addresses exist.
 */
let decoyHash;
async function burnComparableTime(password) {
  decoyHash ??= await hashPassword(randomBytes(32).toString("hex"));
  await passwordMatches(password, decoyHash).catch(() => false);
}

/**
 * Creates the admin from the environment if the collection has none for that
 * email yet. Runs at most once per process, and is a no-op without both vars.
 */
async function seedAdminFromEnv() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) return;

  const admins = await getAdminsCollection();
  if (await admins.findOne({ email }, { projection: { _id: 1 } })) return;

  const passwordHash = await hashPassword(password);
  try {
    await admins.insertOne({ email, passwordHash, createdAt: new Date(), seeded: true });
  } catch (error) {
    // Another request seeded the same admin first; the unique index caught it.
    if (error?.code !== 11000) throw error;
  }
}

export function ensureSeedAdmin() {
  return (globalThis.__busAdminSeed ??= seedAdminFromEnv().catch((error) => {
    globalThis.__busAdminSeed = undefined;
    throw error;
  }));
}

/**
 * @returns {Promise<{email: string} | null>} the admin, or null for any failure —
 * callers must not tell the visitor which half of the pair was wrong.
 */
export async function verifyAdminCredentials(email, password) {
  await ensureSeedAdmin();

  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    await burnComparableTime(String(password ?? ""));
    return null;
  }

  const admins = await getAdminsCollection();
  const admin = await admins.findOne({ email: normalized });
  if (!admin) {
    await burnComparableTime(password);
    return null;
  }

  return (await passwordMatches(password, admin.passwordHash)) ? { email: admin.email } : null;
}

/** True only if this email is a real admin — the session cookie carries no authority of its own. */
export async function isAdminEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const admins = await getAdminsCollection();
  return Boolean(await admins.findOne({ email: normalized }, { projection: { _id: 1 } }));
}

export async function changeAdminPassword(email, currentPassword, newPassword) {
  const admin = await verifyAdminCredentials(email, currentPassword);
  if (!admin) return { ok: false, error: "That current password is not right." };
  if (String(newPassword ?? "").length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const admins = await getAdminsCollection();
  await admins.updateOne(
    { email: admin.email },
    { $set: { passwordHash: await hashPassword(newPassword), updatedAt: new Date() }, $unset: { seeded: "" } },
  );

  return { ok: true };
}
