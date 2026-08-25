# Phase 0 — regression baseline

Golden snapshots of the legacy API, captured from live production before the
Next.js migration. This is the gate the new data layer has to pass.

## Files

| Path | What it is |
| --- | --- |
| `capture.mjs` | Walks every read endpoint and writes the snapshots. Run once. |
| `compare.mjs` | Replays the captured request list against a target and diffs it. Run often. |
| `snapshots/` | Canonicalised JSON responses, one per request (705 files — see Known gaps). |
| `manifest.json` | Request list, status, byte count and SHA-256 per response. |
| `urls.txt` | 799 public permalinks, for the post-cutover 404 sweep. |
| `content.json` | Raw HTML of all 118 pieces, keyed by page — input for the renderer snapshot. |
| `tags.txt` | Every distinct element appearing in piece content. |

No dependencies — native `fetch`, Node 18+.

## Usage

```bash
# Re-capture (only when the baseline is deliberately being reset)
node baseline/capture.mjs --base https://deciduous.darpa.press

# Gate the new implementation
node baseline/compare.mjs --base http://localhost:3000
node baseline/compare.mjs --base http://localhost:3000 --only piece
node baseline/compare.mjs --base http://localhost:3000 --verbose
```

`compare.mjs` exits non-zero on any difference, so it drops straight into CI.
Differences are reported as structural paths (`.persons[0].slug`), not text
diffs, so a changed ObjectId or a reordered array reads clearly.

## Coverage

Captured at 118 pieces / 60 persons / 443 distinct words. 753 requests.

- All 118 `?page=N` piece reads — the page number **is** the permalink, so every
  one is asserted.
- `/api/pieces` collection variants: `?count`, `?graph`, `?tree`, `?parent=` for
  all 55 distinct parents, and four sort/order/limit combinations.
- All 60 persons by slug; all 443 distinct words by id; 5 WordNet lookups.
- 14 search terms drawn from real title vocabulary, plus a guaranteed-empty probe.

Not covered, deliberately: `POST`/`PUT`/`DELETE`, `/api/file`, `/api/user`.
Those are mutations and admin reads behind auth; they get tested against a
scratch database in Phase 5, not against production.

## What the capture turned up

**`<attr>` has no handler.** Used 6 times across 2 pieces as a caption element
("A sample of the wallpaper in lift b"). `Parser.jsx` declares handlers for
`aa`, `cartesian`, `iframe`, `img`, `lightimg`, `numberofdocuments` and `tree` —
but not this. It currently renders as an unknown inline element with no styling.
The rehype components map needs an explicit decision: style it as a caption, or
keep rendering it bare.

**Per-piece `<style>` blocks are load-bearing.** 4 pieces ship their own CSS
(`.green-paper`, `.yellow-paper`, `.forum-reply`) setting fonts like Futura and
P22 Cezanne. `rehype-sanitize` strips `<style>` by default, which would silently
flatten those pages. They need to be allowed through, ideally scoped per piece.
One piece also carries a `<link>` to a Google Font (Anonymous Pro).

**Malformed video markup.** Page 94 has `<video ... />` self-closed. `<video>`
is not a void element, so parse5 (rehype) will nest everything after it *inside*
the video element, where `html-to-react` tolerated it. Pages 44, 54 and 94 need
checking specifically after the parser swap.

**Every verb is listed twice in the word tree.** `getAllWords` buckets
`pos` `a`/`v`/`s` into `qualities` and `pos` `v` into `acts`, so all 47 verbs
appear in both branches — 490 tree entries for 443 distinct words. Visible in
the UI as duplicated entries in the word index. Decide during the port whether
that is intended (a verb genuinely being both a quality and an act) or a
filter that should read `pos === "a" || pos === "s"`.

**`getWordById` broke during capture and has not recovered.** All 490 word
requests returned 200 while capturing. Shortly afterwards the endpoint began
returning `FUNCTION_INVOCATION_FAILED` in ~70ms and has stayed that way — on
fresh invocation ids, not a single wedged warm instance, so this is not simply
an instance that needs to recycle.

The runtime log is:

```
Invoke Error  { errorType: "Error", errorMessage: "socket hang up",
                code: "ECONNRESET",
                stack: [ "at connResetException (internal/errors.js:609:14)",
                         "at Socket.socketOnEnd (_http_client.js:458:23)", … ] }
```

`_http_client.js` is the `@now/node` bridge that proxies each invocation to the
Express app over local HTTP, not application code — "socket hang up" means the
handler never responded. The Node internal paths also date the runtime to
Node 12/14.

Probing the endpoint narrows it precisely:

| Request | Result |
| --- | --- |
| `/api/word/id/` (no id) | Express HTML 500 — app responded |
| `?id=` | Express HTML 500 — app responded |
| `?id=w-` | Express HTML 500 — app responded |
| `?id=w-99999999n` | `FUNCTION_INVOCATION_FAILED` |
| `?id=w-407535n` | `FUNCTION_INVOCATION_FAILED` |

So the module loads, Express runs, its error handler works and Mongo is
reachable — the three early-failing requests all take the `try`/`catch` →
`next(e)` path and render normally. The only thing the two fatal requests have
in common is that both reach **`wordnet.getAsync()`**. `/api/word/lookup/`,
which calls `lookupAsync` against the WordNet *index* files rather than the
*data* files, still serves.

Since the surrounding `try`/`catch` demonstrably works for other errors yet
these requests kill the process, the failure must be **uncatchable** — an async
error event from node-wordnet's `fs` reads of `data.{pos}`, raised outside the
promise chain where no `try`/`catch` can reach it.

Not established: why it started. It served 490 requests during capture before
failing, and fresh invocation ids fail too, so it is not one wedged warm
instance. A redeploy is the obvious first remedy — it rebuilds the bundle,
including the 44 MB `wndb-with-exceptions` dict files.

Disproven along the way, recorded so they are not re-investigated: the
mongoose `connection.close()` / `bufferCommands: false` path (Mongo is
demonstrably reachable), and a non-terminating `getHypernyms` loop (replayed
locally against the real corpus for the failing ids — terminates in 6 and 9
iterations).

The porting lesson stands regardless, and is the strongest single argument in
the plan: hoist WordNet to one shared module-scoped instance, wrap its file
access so an `fs` error event cannot take the process down, and never close the
mongoose connection. Under Fluid Compute instances live *longer* and serve more
requests, so a naive port of this code fails sooner, not later.

## Known gaps

The first capture wrote 705 files for 753 requests: 47 were duplicate word ids
(see above) and one was a real filename collision — `order=-1` and `order=1`
slugified identically, so one overwrote the other. Both are fixed in
`capture.mjs` (ids are deduped; filenames now carry a digest of the full path).

The stored SHA-256 is per-request and was always correct, so the gate itself was
never compromised — only the on-disk "expected" file used to render one diff.
**Re-run the full capture once `/api/word/id/` is serving again** to regenerate
the snapshot set under the fixed naming.

## Notes

`snapshots/` is ~16 MB on disk and compresses well in git's packfile. It is
intended to be deleted once the migration is signed off.

Re-running `capture.mjs` overwrites the baseline. The manifest records
`capturedAt` and the discovered id/slug/page lists, so a later capture that
disagrees tells you the content changed underneath the baseline rather than the
code regressing.
