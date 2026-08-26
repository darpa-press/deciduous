import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { BASE_URL, IS_LOCAL, get, tryGet, paneCount, siteAvailable } from "./helpers.mts";

/**
 * The site, over HTTP.
 *
 * Runs against whatever BASE_URL points at — a local `next start` by default,
 * or a deployment. Read-only throughout: nothing here mutates the catalogue,
 * so it is safe against any environment.
 *
 *   npm run test:site
 *   BASE_URL=https://deciduous.example npm run test:site
 */

const up = await siteAvailable();
const skip = () => (up ? false : `nothing serving at ${BASE_URL} — run \`npm start\` first`);

const manifest = JSON.parse(readFileSync("baseline/manifest.json", "utf8"));
const pages: number[] = manifest.discovered.pages;
const personSlugs: string[] = manifest.discovered.personSlugs;

/** Next renders a caught error into this; a pane must never contain one. */
const errored = (html: string) => /__NEXT_ERROR_CODE|Application error/.test(html);

describe("the codex reads", () => {
    test("/ redirects to the opening spread", { skip: skip() }, async () => {
        const res = await get("/");
        assert.equal(res.status, 307);
        assert.ok(res.location?.endsWith("/2/125"), `redirected to ${res.location}`);
    });

    // Regression: the redirect took its origin from the request's own Host
    // header, which is the caller's to choose behind any proxy that does not
    // validate it.
    test("the redirect ignores a forged Host header", { skip: skip() }, async () => {
        const res = await get("/", { headers: { host: "attacker.example" } });
        assert.ok(
            !res.location?.includes("attacker.example"),
            `open redirect to ${res.location}`
        );
    });

    test("a single pane serves", { skip: skip() }, async () => {
        const res = await get("/2");
        assert.equal(res.status, 200);
        assert.equal(paneCount(res.body), 1);
        assert.ok(!errored(res.body));
    });

    test("a two-pane URL serves both", { skip: skip() }, async () => {
        const res = await get("/2/125");
        assert.equal(res.status, 200);
        assert.equal(paneCount(res.body), 2);
    });

    test("/index serves the index, not the home pair", { skip: skip() }, async () => {
        const res = await get("/index");
        assert.equal(res.status, 200);
        assert.equal(paneCount(res.body), 1);
    });

    test("/index is titled as the index", { skip: skip() }, async () => {
        // Regression: generateMetadata got this right and the client then
        // overwrote it with the bare fallback.
        const res = await get("/index");
        const title = res.body.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "";
        assert.match(title, /Index/, `title was "${title}"`);
    });

    test("each kind of pane serves", { skip: skip() }, async () => {
        for (const path of ["/all", "/graph", "/person", "/word", "/index-a", "/2c"]) {
            const res = await get(path);
            assert.equal(res.status, 200, `${path} -> ${res.status}`);
            assert.ok(!errored(res.body), `${path} rendered an error`);
        }
    });

    test("a person and a word pane serve", { skip: skip() }, async () => {
        const person = await get(`/p-${personSlugs[0]}`);
        assert.equal(person.status, 200);
        assert.ok(!errored(person.body));

        const word = await get("/w-293253r");
        assert.equal(word.status, 200);
        assert.ok(!errored(word.body));
    });

    test("/random sends you somewhere real", { skip: skip() }, async () => {
        const res = await get("/random");
        assert.ok([302, 307].includes(res.status), `${res.status}`);
        const followed = await get(new URL(res.location!, BASE_URL).pathname);
        assert.equal(followed.status, 200);
    });

    test("an unknown segment is not-found, not a crash", { skip: skip() }, async () => {
        for (const path of ["/nonsense", "/p-nobody-at-all", "/w-nosuchid", "/999999"]) {
            const res = await get(path);
            assert.equal(res.status, 200, `${path} -> ${res.status}`);
            assert.ok(!errored(res.body), `${path} rendered an error`);
        }
    });

    // Regression: an undecodable escape threw "failed to decode param" inside
    // the router and answered a bare 500.
    //
    // Serving itself, the app refuses it cleanly with a 400. Deployed, Vercel's
    // edge closes the connection before the function is reached, so the most
    // that can be asserted there is that no page is ever served for one.
    test("a malformed escape is refused, not a crash", { skip: skip() }, async () => {
        for (const path of ["/%E0%A4%A", "/%", "/%zz", "/2/%E0%A4%A", "/p-%E0"]) {
            const res = await tryGet(path);

            if (IS_LOCAL) {
                assert.equal(res?.status, 400, `${path} -> ${res?.status}`);
                continue;
            }

            assert.ok(
                res === null || res.status >= 400,
                `${path} was served with ${res?.status}`
            );
            assert.ok(!res || !errored(res.body), `${path} rendered a framework error`);
        }
    });

    test("a well-formed escape still resolves", { skip: skip() }, async () => {
        // `%C3%A9` is valid; it just names a pane that does not exist.
        const res = await get("/p-caf%C3%A9");
        assert.equal(res.status, 200);
        assert.ok(!errored(res.body));
    });
});

describe("the pane stack", () => {
    // Regression: every segment costs two database reads and nothing capped
    // the path, so one anonymous request could fan out into thousands.
    test("is capped however many segments are asked for", { skip: skip() }, async () => {
        const long = "/" + Array.from({ length: 200 }, (_, i) => (i % 100) + 1).join("/");
        const res = await get(long);
        assert.equal(res.status, 200);
        assert.ok(paneCount(res.body) <= 8, `${paneCount(res.body)} panes rendered`);
    });

    test("renders as many panes as the URL names", { skip: skip() }, async () => {
        assert.equal(paneCount((await get("/2/125/index")).body), 3);
        assert.equal(paneCount((await get("/2/125/index/all")).body), 4);
    });
});

describe("links", () => {
    // Regression: a link built against a shorter stack wrote past the end and
    // produced `//5`, which is protocol-relative — another origin entirely.
    test("no page emits a protocol-relative or empty-segment href", { skip: skip() }, async () => {
        for (const path of ["/index", "/2", "/2/125", "/all", "/person", "/word", "/2c"]) {
            const body = (await get(path)).body;
            const bad = [...body.matchAll(/href="(\/\/[^"]*)"/g)]
                .map((m) => m[1])
                // The codex's own content carries protocol-relative links to
                // external hosts, authored in 2020 — `//placehold.it/20x20`.
                // Those are the author's; a hostname has a dot in it. What
                // must never appear is a *pane* link written that way, which
                // is what an out-of-range stack position used to produce.
                .filter((href) => !href.slice(2).split("/")[0].includes("."));
            assert.deepEqual(bad, [], `${path} emitted ${bad.join(", ")}`);
        }
    });

    // Regression: the three bucket headings carry an empty id, and linking
    // them anyway sent every one to /w-, which resolves to not found.
    test("the word index does not link to /w-", { skip: skip() }, async () => {
        const body = (await get("/word")).body;
        assert.ok(!body.includes('href="/w-"'), "a bucket heading is a dead link");
    });
});

describe("per-piece stylesheets", () => {
    // Regression: a <style> block is global, and the codex shows several
    // pieces at once, so page 97's bare `pre` rule restyled page 81's.
    test("are scoped to the piece that authored them", { skip: skip() }, async () => {
        const body = (await get("/97")).body;
        const rules = [...body.matchAll(/([^{}]*)\{[^{}]*\}/g)].map((m) => m[1].trim());
        const bare = rules.filter((r) => /^pre$/.test(r));
        assert.deepEqual(bare, [], "an unscoped `pre` rule reached the document");
        assert.ok(body.includes(".piece-scope-97"), "the scope class is missing");
    });

    test("cannot reach a neighbouring piece", { skip: skip() }, async () => {
        const body = (await get("/97/81")).body;
        // Both pieces are present, and 97's rules name only 97's scope.
        assert.ok(body.includes("piece-scope-97") && body.includes("piece-scope-81"));
        const scoped = [...body.matchAll(/\.piece-scope-(\d+)\s+pre\s*\{/g)].map((m) => m[1]);
        for (const page of scoped) {
            assert.equal(page, "97", `a pre rule was scoped to ${page}`);
        }
    });
});

describe("the admin surface is closed", () => {
    test("editors do not render when logged out", { skip: skip() }, async () => {
        for (const path of ["/edit-2", "/new", "/new-person", `/edit-person-${personSlugs[0]}`]) {
            const res = await get(path);
            assert.equal(res.status, 200, `${path} -> ${res.status}`);
            assert.ok(!res.body.includes("form-buttons"), `${path} rendered an editor`);
        }
    });

    // Regression: the config probe ran before the auth check, so an anonymous
    // caller learned whether Blob was configured and how to configure it.
    test("the upload route refuses anonymous callers with 401", { skip: skip() }, async () => {
        const res = await get("/api/upload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                type: "blob.generate-client-token",
                payload: {
                    pathname: "probe.png",
                    callbackUrl: `${BASE_URL}/api/upload`,
                    multipart: false,
                    clientPayload: null,
                },
            }),
        });
        assert.equal(res.status, 401, res.body.slice(0, 200));
        assert.ok(!/BLOB_READ_WRITE_TOKEN/.test(res.body), "leaked its configuration");
    });

    // Regression: a body that is not JSON rejected outside the try, which was
    // an uncaught 500 rather than the 400 the handler intends.
    test("the upload route does not 500 on a malformed body", { skip: skip() }, async () => {
        const res = await get("/api/upload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "not-json",
        });
        assert.ok(res.status < 500, `${res.status}`);
    });

    // The exports are the whole catalogue in one response, and `?content=1` is
    // every piece's stored HTML.
    test("every export refuses anonymous callers", { skip: skip() }, async () => {
        for (const path of [
            "/export/cards.json",
            "/export/cards.xml",
            "/export/cards.xml?content=1",
            "/export/people.txt",
            "/export/words.txt",
        ]) {
            const res = await get(path);
            assert.equal(res.status, 401, `${path} -> ${res.status}`);
        }
    });

    test("the login page serves", { skip: skip() }, async () => {
        assert.equal((await get("/login")).status, 200);
    });
});

describe("the service worker kill-switch", () => {
    test("is served and must not be cached", { skip: skip() }, async () => {
        const res = await get("/service-worker.js");
        assert.equal(res.status, 200);
        assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    });

    test("unregisters rather than serving anything from cache", { skip: skip() }, async () => {
        const body = (await get("/service-worker.js")).body;
        assert.match(body, /unregister\(\)/);
        assert.match(body, /caches\.delete/);
        assert.ok(!body.includes("respondWith"), "it still answers fetches from cache");
    });
});

describe("every permalink", () => {
    test("serves without an error", { skip: skip() }, async () => {
        const urls = readFileSync("baseline/urls.txt", "utf8")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        assert.ok(urls.length > 500, "the captured inventory should be substantial");

        const broken: string[] = [];
        const queue = [...urls];

        // Bounded concurrency: this is 799 requests.
        await Promise.all(
            Array.from({ length: 8 }, async () => {
                for (let url = queue.pop(); url; url = queue.pop()) {
                    // Followed, as a reader's browser would: `/` and `/random`
                    // are redirects by design and land on a real pane.
                    const res = await fetch(BASE_URL + url);
                    const body = await res.text();
                    if (res.status !== 200 || errored(body)) {
                        broken.push(`${url} -> ${res.status}`);
                    }
                }
            })
        );

        assert.deepEqual(broken.slice(0, 10), [], `${broken.length} of ${urls.length} broken`);
    });

    test("every piece page renders its own content", { skip: skip() }, async () => {
        const content: Record<string, string> = JSON.parse(
            readFileSync("baseline/content.json", "utf8")
        );
        // A stride sample, so a run still spans the whole codex.
        const sampled = pages.filter((_, i) => i % 10 === 0);

        for (const page of sampled) {
            const res = await get(`/${page}`);
            const stored = String(content[String(page)] ?? "");
            const words = [
                ...new Set(
                    stored
                        .replace(/<[^>]+>/g, " ")
                        .split(/[^\p{L}]+/u)
                        .filter((word) => word.length >= 8)
                ),
            ].slice(0, 5);
            if (!words.length) continue;

            // One miss is allowed: a word can sit in an attribute the
            // sanitiser drops.
            const missing = words.filter((word) => !res.body.includes(word));
            assert.ok(missing.length <= 1, `page ${page} is missing ${missing.join(", ")}`);
        }
    });
});
