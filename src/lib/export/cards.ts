import { getPiecesWithRelations } from "@/lib/queries";
import {
    CODEX_IMPRINT,
    CODEX_NAME,
    cardWordLabel,
    cardWordSource,
    shelfMark,
    type CardWord,
} from "@/lib/card";

/**
 * The catalogue cards as data, for typesetting.
 *
 * This is the intermediate form on the way to a print edition: everything the
 * card shows, resolved and flattened, with nothing left as an id to chase. It
 * is deliberately not IDML — IDML is a zipped package of InDesign's own XML,
 * and generating it is a separate step that can read this.
 *
 * Cards come in page order, which is the order they are bound in.
 */

export interface ExportedWord {
    /** Stable id, matching the `w-` URL form. */
    id: string;
    /** The text the card prints for this word. */
    label: string;
    /** Whether `label` came from the gloss or the term — they alternate. */
    source: "gloss" | "term";
    term: string | null;
    gloss: string | null;
    synsetOffset: number | null;
    pos: string | null;
}

export interface ExportedPerson {
    /** 1-based, as numbered on the card. */
    position: number;
    name: string | null;
    slug: string | null;
    birth: number | null;
    death: number | null;
}

export interface ExportedCard {
    page: number | null;
    shelfMark: string;
    title: string | null;
    slug: string | null;
    summary: string | null;
    /** False when the card prints "(No summary available)". */
    hasSummary: boolean;
    stub: boolean;
    parent: { page: number | null; title: string | null } | null;
    words: ExportedWord[];
    people: ExportedPerson[];
    /** Raw stored HTML. Only present when explicitly requested. */
    content?: string;
}

export interface CardExport {
    codex: { name: string; imprint: string };
    count: number;
    cards: ExportedCard[];
}

type RawPiece = {
    page?: number;
    title?: string;
    slug?: string;
    readme?: string;
    stub?: boolean;
    content?: string;
    parent?: { page?: number; title?: string } | null;
    persons?: { name?: string; slug?: string; birth?: number; death?: number }[];
    word?: (CardWord & { _id?: string })[];
};

const nn = <T,>(value: T | undefined | null): T | null => value ?? null;

export async function buildCardExport({
    includeContent = false,
}: { includeContent?: boolean } = {}): Promise<CardExport> {
    const pieces = (await getPiecesWithRelations()) as unknown as RawPiece[];

    const cards: ExportedCard[] = pieces.map((piece) => {
        const words = (piece.word ?? []).map((item) => ({
            id: String(item._id ?? `${item.synsetOffset ?? ""}${item.pos ?? ""}`),
            label: cardWordLabel(item),
            source: cardWordSource(item),
            term: nn(item.word),
            gloss: nn(item.gloss),
            synsetOffset: nn(item.synsetOffset),
            pos: nn(item.pos),
        }));

        const people = (piece.persons ?? []).map((person, index) => ({
            position: index + 1,
            name: nn(person.name),
            slug: nn(person.slug),
            birth: nn(person.birth),
            death: nn(person.death),
        }));

        const summary = piece.readme?.trim() ? piece.readme : null;

        const card: ExportedCard = {
            page: nn(piece.page),
            shelfMark: shelfMark(piece.page),
            title: nn(piece.title),
            slug: nn(piece.slug),
            summary,
            hasSummary: summary !== null,
            stub: Boolean(piece.stub),
            parent: piece.parent
                ? { page: nn(piece.parent.page), title: nn(piece.parent.title) }
                : null,
            words,
            people,
        };

        if (includeContent) card.content = piece.content ?? "";
        return card;
    });

    return {
        codex: { name: CODEX_NAME, imprint: CODEX_IMPRINT },
        count: cards.length,
        cards,
    };
}
