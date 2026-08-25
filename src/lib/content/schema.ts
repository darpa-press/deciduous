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
        // silently flattens those pages.
        "style",
        "link",
    ],

    attributes: {
        ...defaultSchema.attributes,

        // Presentation is content here — the codex styles inline constantly.
        "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "style", "title"],

        a: [...(defaultSchema.attributes?.a ?? []), "href", "target", "rel", "style"],
        img: ["src", "alt", "width", "height", "style", "className", "bg", "title"],

        // `mute` is a typo for `muted` on one piece; preserved rather than
        // corrected, so rendering matches the live site exactly.
        video: ["src", "width", "height", "style", "autoPlay", "loop", "muted", "mute", "controls", "poster", "playsInline"],
        source: ["src", "type", "autoPlay"],

        iframe: ["src", "width", "height", "frameBorder", "allowFullScreen", "allow", "title"],

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
