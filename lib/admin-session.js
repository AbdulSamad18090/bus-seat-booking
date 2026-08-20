import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isAdminEmail, normalizeEmail } from "./admins.js";

/**
 * Admin sessions, as a signed cookie. The cookie carries an email and an expiry
 * signed with AUTH_SECRET; it grants nothing by itself, because every read still
 * checks the email against the `admins` collection. Forging one needs the secret,
 * and even then it only names an account that must already exist.
 */

const COOKIE_NAME = "bkk_admin_session";
const SESSION_HOURS = 8;

/** Only ever called from the server; a missing secret must fail loudly, not silently sign with "". */
function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET is missing or too short (need 32+ chars) — see .env.example.");
  }
  return value;
}

function sign(payload) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(email, expiresAt) {
  const payload = Buffer.from(JSON.stringify({ email, exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** @returns {{email: string} | null} — null for anything tampered with, malformed or expired. */
function decode(value) {
  const [payload, signature] = String(value ?? "").split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  // timingSafeEqual throws on a length mismatch, so check that first.
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!claims?.email || typeof claims.exp !== "number" || claims.exp < Date.now()) return null;
  return { email: normalizeEmail(claims.email) };
}

/** Call from a Server Action or Route Handler only — cookies cannot be set while rendering. */
export async function startAdminSession(email) {
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, encode(normalizeEmail(email), expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function endAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * The signed cookie says who you claim to be; the collection says whether that
 * account still exists. Deleting an admin therefore kills their live sessions.
 *
 * `cache` memoizes this for one render pass, so a page and the components under
 * it can each ask without re-querying.
 */
export const getAdminSession = cache(async () => {
  const cookieStore = await cookies();
  const claims = decode(cookieStore.get(COOKIE_NAME)?.value);
  if (!claims) return null;
  return (await isAdminEmail(claims.email)) ? claims : null;
});

/** Guards a page. Server Actions must call this too — a page check does not protect them. */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Convenience for generating a secret: `node -e "...generateSecret()"`. */
export function generateSecret() {
  return randomBytes(32).toString("base64url");
}
