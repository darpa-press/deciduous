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
 * Words on a card alternate between the synset's gloss and the word itself, by
 * position — which is what gives the card its half-definition, half-index
 * reading. Inherited from Components/CardCatalogue.
 */
export function cardWordLabel(item: CardWord, index: number): string {
    if (index % 2 === 0 && item.gloss) return item.gloss.split(";", 1)[0].trim();
    return item.word ? item.word.trim() : "";
}

/** Which of the two the label was taken from — useful when typesetting. */
export function cardWordSource(item: CardWord, index: number): "gloss" | "term" {
    return index % 2 === 0 && item.gloss ? "gloss" : "term";
}
