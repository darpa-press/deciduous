/**
 * The legacy parser strips every newline from content before parsing:
 *
 *   contentString.replace(/\r?\n|\r/g, "")
 *
 * and substitutes an empty div when content is missing, to avoid erroring.
 * Both are reproduced exactly. The newline stripping is not cosmetic — it
 * changes what <pre> blocks render, and three pieces use <pre>.
 */
export function normaliseContent(content: string | null | undefined): string {
    return content ? String(content).replace(/\r?\n|\r/g, "") : "<div></div>";
}
