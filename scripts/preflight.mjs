#!/usr/bin/env node
//
// Cutover preflight.
//
// Everything that must be true of a deployment before the domain is pointed at
// it. Run against the preview URL first, then against the domain afterwards.
//
//   node scripts/preflight.mjs --base https://deciduous-next.vercel.app
//
// Exits non-zero if any check fails, so it can gate a deploy script.
//
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf("base", "http://localhost:3100").replace(/\/$/, "");
/** A positive integer, or the default — `Number("x")` is NaN, and
 * `Array.from({length: NaN})` is empty, so a typo silently ran zero workers
 * and then crashed on the undefined results it had not filled in. */
const positiveInt = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
};

const CONCURRENCY = positiveInt(argOf("concurrency", 6), 6);
const TIMEOUT_MS = 45000;

async function get(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(BASE + path, { signal: controller.signal, ...options });
        return { status: res.status, headers: res.headers, text: await res.text() };
    } catch (err) {
        return { status: 0, headers: new Headers(), text: "", error: String(err.message || err) };
    } finally {
        clearTimeout(timer);
    }
}

async function pool(items, worker, size = CONCURRENCY) {
    const out = new Array(items.length);
    let cursor = 0;
    await Promise.all(
        Array.from({ length: Math.min(size, items.length) }, async () => {
            while (cursor < items.length) {
                const i = cursor++;
                out[i] = await worker(items[i]);
            }
        })
    );
    return out;
}

const results = [];
const check = (name, ok, detail = "") => {
    results.push({ name, ok, detail });
    console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

console.log(`\n  Cutover preflight\n  target: ${BASE}\n`);

// --- the codex reads ------------------------------------------------------

const home = await get("/", { redirect: "manual" });
check(
    "/ redirects to the opening spread",
    home.status === 307 && (home.headers.get("location") || "").endsWith("/2/125"),
    `${home.status} ${home.headers.get("location") ?? ""}`
);

const piece = await get("/2/125");
check("a two-pane URL serves", piece.status === 200 && piece.text.includes("data-pane"), `${piece.status}`);

const index = await get("/index");
check(
    "/index serves the index, not the home pair",
    index.status === 200 && index.text.includes("index-item"),
    `${index.status}`
);

// --- the service worker kill-switch --------------------------------------
// The single most important check here: without it, every returning visitor
// keeps seeing the 2020 site from their own cache, with nothing to show for it.

const sw = await get("/service-worker.js");
const swKills =
    sw.status === 200 &&
    sw.text.includes("unregister()") &&
    sw.text.includes("caches.delete");
check("service worker kill-switch is served", swKills, `${sw.status}`);
check(
    "kill-switch is not cacheable",
    (sw.headers.get("cache-control") || "").includes("no-store"),
    sw.headers.get("cache-control") ?? "none"
);

// --- admin surface is closed ---------------------------------------------

const editor = await get("/edit-2");
check(
    "editors are closed when logged out",
    editor.status === 200 && !editor.text.includes("form-buttons"),
    `${editor.status}`
);

// A body the upload route will actually carry as far as its auth check. `{}`
// failed the storage library's own body validation first and came back 400 —
// which the old assertion accepted as proof of refusal, alongside the 501 that
// means Blob is simply not configured. Between them the check could not fail,
// so deleting the auth gate outright would still have printed "pass".
const upload = await get("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
            pathname: "preflight-probe.png",
            callbackUrl: `${BASE}/api/upload`,
            multipart: false,
            clientPayload: null,
        },
    }),
});
check(
    "upload route refuses anonymous callers",
    upload.status === 401,
    `${upload.status} — expected 401`
);

const login = await get("/login");
check("login page serves", login.status === 200, `${login.status}`);

// --- exports --------------------------------------------------------------

// The exports are the whole catalogue in one response — and with `?content=1`,
// every piece's stored HTML — so they are behind the admin session now. What
// preflight can assert without credentials is that they are closed.
const exportJson = await get("/export/cards.json");
check(
    "card export refuses anonymous callers",
    exportJson.status === 401,
    `${exportJson.status} — expected 401`
);

// --- content fidelity against the captured baseline -----------------------

const manifest = JSON.parse(readFileSync("baseline/manifest.json", "utf8"));
const pages = manifest.discovered.pages;

const contentSource = JSON.parse(readFileSync("baseline/content.json", "utf8"));
const sampledPages = pages.filter((_, i) => i % 10 === 0);
const contentChecks = await pool(sampledPages, async (page) => {
    const res = await get(`/${page}`);
    if (res.status !== 200) return { page, ok: false, why: String(res.status) };

    // Look for distinctive whole words rather than a fixed slice. The app
    // strips newlines from stored content before parsing, and the codex is
    // full of curly quotes and entities, so any character-offset comparison
    // fails for reasons that have nothing to do with the page being wrong.
    const stored = String(contentSource[String(page)] ?? "");
    const words = [
        ...new Set(
            stored
                .replace(/<[^>]+>/g, " ")
                .split(/[^\p{L}]+/u)
                .filter((word) => word.length >= 8)
        ),
    ].slice(0, 5);

    if (words.length === 0) return { page, ok: true, why: "no prose to check" };

    const missing = words.filter((word) => !res.text.includes(word));
    // Allow one miss: a word can legitimately sit inside an attribute that the
    // sanitiser drops.
    return { page, ok: missing.length <= 1, why: missing.slice(0, 2).join(", ") };
});
const contentBad = contentChecks.filter((c) => !c.ok);
check(
    `sampled piece content renders (${sampledPages.length} pieces)`,
    contentBad.length === 0,
    contentBad.length ? contentBad.slice(0, 3).map((c) => c.page).join(", ") : ""
);

// --- every permalink ------------------------------------------------------

const urls = readFileSync("baseline/urls.txt", "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
process.stdout.write(`  ....  sweeping ${urls.length} permalinks`);
let done = 0;
const swept = await pool(urls, async (url) => {
    const res = await get(url);
    done++;
    if (done % 100 === 0) process.stdout.write(".");
    const errored = /__NEXT_ERROR_CODE|Application error/.test(res.text);
    return { url, ok: res.status === 200 && !errored, status: res.status };
});
process.stdout.write("\r");
const sweptBad = swept.filter((s) => !s.ok);
check(
    `all ${urls.length} permalinks serve`,
    sweptBad.length === 0,
    sweptBad.length ? `${sweptBad.length} failing, e.g. ${sweptBad.slice(0, 3).map((s) => s.url).join(", ")}` : ""
);

// --- report ---------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log(
    `\n  ${results.length - failed.length}/${results.length} checks passed` +
        (failed.length ? ` — NOT ready to cut over\n` : ` — ready to cut over\n`)
);
process.exit(failed.length ? 1 : 0);
