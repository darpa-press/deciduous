import { PaneLink } from "@/components/PaneLink";
import { CODEX_IMPRINT, CODEX_NAME, cardWordLabel, shelfMark, type CardWord } from "@/lib/card";

/**
 * The catalogue card for a piece — the view behind the little card button.
 *
 * Ported from Components/CardCatalogue. It is a library card: title and
 * summary, the piece it hangs from, its words, the people in it, and a shelf
 * mark along the bottom.
 */

interface CardPerson {
    name?: string;
    slug?: string;
    birth?: number;
}

export interface CardPiece {
    page?: number;
    title?: string;
    readme?: string;
    parent?: { page?: number; title?: string } | null;
    persons?: CardPerson[];
    word?: CardWord[];
}

export function PieceCard({ piece, index }: { piece: CardPiece; index: number }) {
    const { page, title, readme, parent, persons, word } = piece;

    return (
        <div className="card-content">
            <div>
                <div>
                    <div className="card-title">
                        {/* Not contextual: this drops the card and shows the piece. */}
                        <PaneLink target={String(page)} index={index}>
                            {title}
                        </PaneLink>
                        .
                    </div>
                    <div className="card-background">
                        {readme || <span style={{ opacity: 0.2 }}>(No summary available)</span>}
                    </div>
                </div>

                <div className="card-inherit">
                    {parent && (
                        <PaneLink target={String(parent.page)} index={index} contextual>
                            @{parent.title}
                        </PaneLink>
                    )}
                </div>

                <div className="card-words">
                    <span className="card-smallcaps">Words</span>—
                    {word?.map((item, i) => (
                        <span key={`${item.synsetOffset}${item.pos}-${i}`}>
                            <PaneLink
                                target={`w-${item.synsetOffset}${item.pos}`}
                                index={index}
                                contextual
                            >
                                {i ? ", " : ""}
                                {cardWordLabel(item, i)}
                            </PaneLink>
                        </span>
                    ))}
                </div>
            </div>

            <div className="card-people">
                {persons?.map((person, i) => (
                    <div className="card-person" key={person.slug ?? i}>
                        <PaneLink target={`p-${person.slug}`} index={index} contextual>
                            {i + 1}. {person.name} ({person.birth})
                        </PaneLink>
                    </div>
                ))}
            </div>

            <div className="card-meta">
                <div>
                    <span className="card-smallcaps">{CODEX_NAME}</span>/{CODEX_IMPRINT}
                </div>
                <div>{shelfMark(page)}</div>
            </div>
        </div>
    );
}
