import { defaultSchema } from "rehype-sanitize";
import type { Options as SanitizeSchema } from "rehype-sanitize";

/**
 * Sanitise allowlist for piece content.
 *
 * Derived from `scripts/analyse-content.mjs`, which inventories every element
 * and attribute actually used across all 118 pieces — not guessed. The default
 * rehype-sanitize schema would strip the codex's own vocabulary entirely:
 * every custom element, every inline style, and the four pieces that ship
 * their own <style> block.
 *
 * Content is authored solely by the site owner behind admin auth, so this is
 * defence in depth rather than a trust boundary. It is deliberately permissive
 * about presentation (inline styles, per-piece CSS) and strict about script
 * execution: no <script>, no event handlers, no javascript: URLs.
 *
 * scripts/verify-content-render.mts proves the allowlist loses nothing.
 */

/** Elements the codex defines itself, handled by components/content. */
export const CUSTOM_ELEMENTS = [
    "aa",
    "attr",
    "cartesian",
    "lightimg",
    "numberofdocuments",
    "tree",
] as const;

type PropertyDefinition = NonNullable<SanitizeSchema["attributes"]>[string][number];

/**
 * Let `className` through on every tag.
 *
 * The GitHub-derived default restricts it to fixed values on seven tags —
 * `code: [["className", {}]]`, `li: [["className", "task-list-item"]]` and so
 * on. hast-util-sanitize applies the tag-specific rule first and never falls
 * through to the `"*"` entry, and an array-valued property whose value is not
 * permitted sanitises to `class=""`. So an authored class on <a>, <code>,
 * <li>, <ol>, <ul>, <h2> or <section> was not preserved, it was *emptied* —
 * silently, with no error, which is the worst way for content to be lost.
 *
 * Dropping the inherited tuples lets the unrestricted entry below stand.
 */
function withFreeClassName(
    attributes: NonNullable<SanitizeSchema["attributes"]>
): NonNullable<SanitizeSchema["attributes"]> {
    const out: NonNullable<SanitizeSchema["attributes"]> = {};

    for (const [tag, list] of Object.entries(attributes)) {
        const kept = list.filter(
            (entry) => !(Array.isArray(entry) && entry[0] === "className")
        ) as PropertyDefinition[];
        out[tag] = kept.includes("className") ? kept : [...kept, "className"];
    }

    return out;
}

const base = withFreeClassName(defaultSchema.attributes ?? {});

export const contentSchema: SanitizeSchema = {
    ...defaultSchema,

    tagNames: [
        ...(defaultSchema.tagNames ?? []),
        ...CUSTOM_ELEMENTS,
        // Media and embeds the content uses that the default schema omits.
        "iframe",
        "video",
        "source",
        "audio",
        "picture",
        // Presentational text elements. `small` is used on page 11 and is not
        // in the GitHub-derived default schema. The rest are included so that
        // reaching for an ordinary tag in a future edit does not silently
        // vanish — sanitising drops unknown elements without erroring.
        "small",
        "u",
        "s",
        "mark",
        "sub",
        "sup",
        "abbr",
        "figure",
        "figcaption",
        // Per-piece CSS. Four pieces define classes like .green-paper and
        // .forum-reply that carry their entire visual design; dropping these
        // silently flattens those pages. Rules are scoped to the piece at
        // render time — see scopeStyles in lib/content/render.tsx.
        "style",
        "link",
    ],

    attributes: {
        ...base,

        // Presentation is content here — the codex styles inline constantly.
        "*": [...(base["*"] ?? []), "className", "style", "title"],

        a: [...(base.a ?? []), "href", "target", "rel", "style"],
        img: ["src", "alt", "width", "height", "style", "className", "bg", "title"],

        // `mute` is a typo for `muted` on one piece; preserved rather than
        // corrected, so rendering matches the live site exactly.
        video: ["src", "width", "height", "style", "autoPlay", "loop", "muted", "mute", "controls", "poster", "playsInline"],
        source: ["src", "type", "autoPlay"],

        iframe: ["src", "width", "height", "frameBorder", "allowFullScreen", "allow", "title", "id"],

        style: ["type", "media"],
        link: ["href", "rel", "type", "media"],

        // Custom elements.
        aa: ["to", "href", "className", "style", "title"],
        attr: ["className", "style"],
        lightimg: ["src", "width", "height", "bg", "className", "title", "alt", "style"],
        cartesian: ["shuffle", "limit", "contents", "className", "style"],
        tree: [],
        numberofdocuments: [],
    },

    /**
     * Leave `id` alone.
     *
     * The default prefixes `id`, `name` and the two aria id-references with
     * "user-content-" to stop content clobbering the host page's DOM. Here it
     * only broke the content's own anchors: `<div id="foo">` became
     * `id="user-content-foo"` while `<a href="#foo">` was left untouched, so
     * every in-page link an author wrote silently went nowhere. Nothing in the
     * app looks elements up by id, and the aria references have to agree with
     * the ids they point at, so all four pass through as authored.
     */
    clobber: [],

    protocols: {
        ...defaultSchema.protocols,
        href: ["http", "https", "mailto", "#"],
        src: ["http", "https"],
    },

    // Keep <style> and <link> where the author put them. React 19 hoists them
    // itself; letting sanitize strip them by position would defeat that.
    ancestors: {
        ...defaultSchema.ancestors,
        source: ["video", "audio", "picture"],
    },
};
