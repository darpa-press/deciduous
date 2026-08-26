/**
 * The catalogue card's own rules, shared by the card on screen and by the
 * print export, so the two cannot drift apart.
 */

export const CODEX_NAME = "Deciduous";
export const CODEX_IMPRINT = "Arbes san sang";

/** The shelf mark printed along the bottom of every card. */
export function shelfMark(page: number | undefined): string {
    return `DC001.${page ?? ""}`;
}

export interface CardWord {
    word?: string;
    gloss?: string;
    synsetOffset?: number;
    pos?: string;
}

/**
 * Words on a card read as their synset's gloss, cut at the first semicolon.
 *
 * Inherited from Components/CardCatalogue, where the label alternated with
 * position — gloss on the first word, the term on the second, and so on down
 * the list — so a card read half definition, half index. Which of the two a
 * word got depended on nothing but where it landed in the piece's list, so the
 * same synset printed as a definition on one card and as a bare word on
 * another. Turned off for now in favour of the gloss throughout; the term
 * remains the fallback for a synset stored without one.
 */
export function cardWordLabel(item: CardWord): string {
    if (item.gloss) return item.gloss.split(";", 1)[0].trim();
    return item.word ? item.word.trim() : "";
}

/** Which of the two the label was taken from — useful when typesetting. */
export function cardWordSource(item: CardWord): "gloss" | "term" {
    return item.gloss ? "gloss" : "term";
}
