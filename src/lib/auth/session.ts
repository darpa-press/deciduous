import "server-only";

import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";

/**
 * Single-admin session.
 *
 * The codex has exactly one author, so this is a password and a signed cookie
 * rather than an identity system. It replaces the legacy scheme, which hashed
 * passwords with unsalted md5, signed the whole user document (password hash
 * included) into a JWT, stored that in a cookie readable by JavaScript, and
 * also accepted it from a query string.
 *
 * Here: scrypt for the password, an HMAC-signed cookie that carries only an
 * expiry, httpOnly so scripts cannot read it, and no query-string fallback.
 * No third-party dependency — Node's crypto is enough for one user.
 */

const scryptAsync = promisify(scrypt) as (
    password: string,
    salt: string,
    keylen: number
) => Promise<Buffer>;

export const SESSION_COOKIE = "deciduous_session";
const KEY_LENGTH = 64;
/** Matches the legacy token lifetime. */
const SESSION_DAYS = 7;

function sessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("SESSION_SECRET is not set.");
    return secret;
}

/** `salt:hash`, as produced by `npm run admin:hash`. */
function adminPasswordHash(): string | null {
    return process.env.ADMIN_PASSWORD_HASH || null;
}

/** Derive the stored form of a password. Used by the hashing script. */
export async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
    const derived = await scryptAsync(password, salt, KEY_LENGTH);
    return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string): Promise<boolean> {
    const stored = adminPasswordHash();
    if (!stored) return false;

    const [salt, expected] = stored.split(":");
    if (!salt || !expected) return false;

    const derived = await scryptAsync(password, salt, KEY_LENGTH);
    const expectedBuffer = Buffer.from(expected, "hex");

    // Length must match before timingSafeEqual, which throws otherwise.
    if (expectedBuffer.length !== derived.length) return false;
    return timingSafeEqual(expectedBuffer, derived);
}

function sign(value: string): string {
    return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

/** Token is `expiryMillis.signature`. It carries no identity — there is one user. */
function createToken(): string {
    const expiry = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    return `${expiry}.${sign(expiry)}`;
}

function tokenIsValid(token: string | undefined): boolean {
    if (!token) return false;

    const [expiry, signature] = token.split(".");
    if (!expiry || !signature) return false;

    const expected = sign(expiry);
    // Compare as buffers of equal length, in constant time.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

    return Number(expiry) > Date.now();
}

export async function startSession() {
    const store = await cookies();
    store.set(SESSION_COOKIE, createToken(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
}

export async function endSession() {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
}

/** Whether the current request carries a valid session. */
export async function isLoggedIn(): Promise<boolean> {
    try {
        const store = await cookies();
        return tokenIsValid(store.get(SESSION_COOKIE)?.value);
    } catch (error) {
        // Under Cache Components `cookies()` rejects as a control-flow signal
        // when a prerender aborts, and as an error if it is ever reached from
        // inside `use cache`. Swallowing those failed closed, so it was not a
        // way in — but it silently defeated the Suspense boundary SessionDot
        // exists for, and would have hidden the `use cache` misuse outright.
        unstable_rethrow(error);
        // What is left is a genuine read outside any request scope.
        return false;
    }
}

/** Throw unless the request is authenticated. Guards every mutating action. */
export async function requireAdmin(): Promise<void> {
    if (!(await isLoggedIn())) throw new Error("Not authorised.");
}
