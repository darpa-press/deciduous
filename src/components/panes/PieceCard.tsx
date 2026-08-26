import type { ReactNode } from "react";

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

/**
 * Card links are suppressed where the whole card is already one link — the
 * search overlay wraps each result in an anchor, and an anchor inside an
 * anchor is invalid markup whose click handlers compose wrongly: the inner
 * link pushed its target and the outer one immediately overwrote it, so every
 * link inside a result went to the result's own piece instead.
 */
function CardLink({
    linked,
    target,
    index,
    contextual = false,
    children,
}: {
    linked: boolean;
    target: string;
    index: number;
    contextual?: boolean;
    children: ReactNode;
}) {
    if (!linked) return <>{children}</>;
    return (
        <PaneLink target={target} index={index} contextual={contextual}>
            {children}
        </PaneLink>
    );
}

export function PieceCard({
    piece,
    index,
    linked = true,
}: {
    piece: CardPiece;
    index: number;
    /** False where an ancestor is already the link for the whole card. */
    linked?: boolean;
}) {
    const { page, title, readme, parent, persons, word } = piece;

    return (
        <div className="card-content">
            <div>
                <div>
                    <div className="card-title">
                        {/* Not contextual: this drops the card and shows the piece. */}
                        <CardLink linked={linked} target={String(page)} index={index}>
                            {title}
                        </CardLink>
                        .
                    </div>
                    <div className="card-background">
                        {readme || <span style={{ opacity: 0.2 }}>(No summary available)</span>}
                    </div>
                </div>

                <div className="card-inherit">
                    {parent && (
                        <CardLink linked={linked} target={String(parent.page)} index={index} contextual>
                            @{parent.title}
                        </CardLink>
                    )}
                </div>

                <div className="card-words">
                    <span className="card-smallcaps">Words</span>—
                    {word?.map((item, i) => (
                        <span key={`${item.synsetOffset}${item.pos}-${i}`}>
                            <CardLink
                                linked={linked}
                                target={`w-${item.synsetOffset}${item.pos}`}
                                index={index}
                                contextual
                            >
                                {i ? ", " : ""}
                                {cardWordLabel(item)}
                            </CardLink>
                        </span>
                    ))}
                </div>
            </div>

            <div className="card-people">
                {persons?.map((person, i) => (
                    <div className="card-person" key={person.slug ?? i}>
                        <CardLink linked={linked} target={`p-${person.slug}`} index={index} contextual>
                            {i + 1}. {person.name} ({person.birth})
                        </CardLink>
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
