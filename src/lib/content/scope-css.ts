/**
 * Scope a piece's own <style> block to that piece.
 *
 * Four pieces ship a stylesheet that carries their entire visual design, and
 * the allowlist keeps them (see content/schema.ts). But a <style> element is
 * global wherever it lands in the document, and three of the four are scoped
 * only by convention — page 97's is not:
 *
 *     pre {font-size: 0.5rem; letter-spacing: 0.5em; font-weight: bold;}
 *
 * Pages 81, 97 and 120 all contain <pre>. Because the codex shows several
 * pieces at once — two panes, a person's collected pieces, /all — page 97's
 * rule reached page 81's ASCII art and restyled it. Prefixing every selector
 * with the piece's own wrapper class confines each stylesheet to the piece
 * that authored it, without touching what is stored.
 *
 * At-rules that establish their own context (@media and friends) are recursed
 * into; @keyframes and @font-face define names rather than match elements, so
 * their contents are left exactly as written.
 */

const NESTED_AT_RULES = new Set(["media", "supports", "layer", "container", "scope"]);

/** Comments can contain braces, which would derail the brace matching below. */
function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function scopeSelectorList(prelude: string, scope: string): string {
    return prelude
        .split(",")
        .map((selector) => {
            const trimmed = selector.trim();
            if (!trimmed) return trimmed;
            // `:root` and friends cannot match inside the piece; anchoring them
            // to the wrapper is what confines them, which is the point.
            return `.${scope} ${trimmed}`;
        })
        .join(", ");
}

export function scopeCss(css: string, scope: string, stripped = false): string {
    const source = stripped ? css : stripComments(css);
    let out = "";
    let i = 0;

    while (i < source.length) {
        let j = i;
        while (j < source.length && source[j] !== "{" && source[j] !== ";") j++;

        // A statement with no block — `@import`, or trailing junk.
        if (j >= source.length) {
            out += source.slice(i);
            break;
        }
        if (source[j] === ";") {
            out += source.slice(i, j + 1);
            i = j + 1;
            continue;
        }

        const prelude = source.slice(i, j);

        let depth = 1;
        let k = j + 1;
        while (k < source.length && depth > 0) {
            if (source[k] === "{") depth++;
            else if (source[k] === "}") depth--;
            k++;
        }
        // An unbalanced block runs to the end of the stylesheet.
        const body = source.slice(j + 1, depth === 0 ? k - 1 : k);

        const trimmed = prelude.trim();
        if (trimmed.startsWith("@")) {
            const name = trimmed.slice(1).split(/[\s({]/)[0].toLowerCase();
            out += NESTED_AT_RULES.has(name)
                ? `${prelude}{${scopeCss(body, scope, true)}}`
                : `${prelude}{${body}}`;
        } else {
            out += `${scopeSelectorList(prelude, scope)}{${body}}`;
        }

        i = k;
    }

    return out;
}
