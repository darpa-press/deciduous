/**
 * Shared rig for the test suite.
 *
 * Two kinds of test live here. Unit tests import the module under test and run
 * anywhere. The database and HTTP suites need something to talk to, and skip
 * themselves — loudly — rather than fail when it is absent, so `npm test` is
 * still useful with nothing running.
 */

/** The site under test. Override with BASE_URL for a deployment. */
export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");

/**
 * Whether we are talking to a local server rather than a deployment.
 *
 * A few behaviours belong to the app when it serves itself, and to the
 * platform in front of it once deployed — a malformed URL is the clear case:
 * Vercel's edge closes the connection before the function is reached.
 */
export const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);

/**
 * The database under test.
 *
 * Defaults to localhost and refuses anything else. These tests write — they
 * create pieces and people to prove the slug and counter behaviour — so
 * pointing them at production would corrupt the catalogue. Same guard, and the
 * same reasoning, as scripts/seed-local.mjs.
 */
export const MONGODB_URI =
    process.env.TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017/deciduous";

const LOCAL = /(^|@|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal)(:|\/|$)/;

export function assertLocalDatabase() {
    if (!LOCAL.test(MONGODB_URI) || /mongodb\+srv:/.test(MONGODB_URI)) {
        throw new Error(
            `Refusing to run write tests against a non-local database:\n  ` +
                MONGODB_URI.replace(/\/\/[^@]*@/, "//***:***@")
        );
    }
}

let dbUp: boolean | null = null;

/** Whether a local MongoDB is reachable, checked once per process. */
export async function databaseAvailable(): Promise<boolean> {
    if (dbUp !== null) return dbUp;
    assertLocalDatabase();
    process.env.MONGODB_URI = MONGODB_URI;
    try {
        const mongoose = (await import("mongoose")).default;
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
        dbUp = true;
    } catch {
        dbUp = false;
    }
    return dbUp;
}

let siteUp: boolean | null = null;

/** Whether the site under test answers, checked once per process. */
export async function siteAvailable(): Promise<boolean> {
    if (siteUp !== null) return siteUp;
    try {
        const res = await fetch(`${BASE_URL}/2`, { redirect: "manual" });
        // A deployment behind Vercel's protection answers 302 to an SSO login,
        // which is not the site under test.
        siteUp = res.status < 400 && !res.headers.get("location")?.includes("vercel.com");
    } catch {
        siteUp = false;
    }
    return siteUp;
}

export interface Fetched {
    status: number;
    headers: Headers;
    body: string;
    location: string | null;
}

/** GET a path on the site under test, without following redirects. */
export async function get(path: string, init: RequestInit = {}): Promise<Fetched> {
    const res = await fetch(BASE_URL + path, { redirect: "manual", ...init });
    return {
        status: res.status,
        headers: res.headers,
        body: await res.text(),
        location: res.headers.get("location"),
    };
}

/** GET, or null when the request never completed at the transport level. */
export async function tryGet(path: string, init: RequestInit = {}): Promise<Fetched | null> {
    try {
        return await get(path, init);
    } catch {
        return null;
    }
}

/** How many panes a rendered stack contains. */
export function paneCount(html: string): number {
    return new Set(html.match(/data-pane="\d+"/g) ?? []).size;
}
