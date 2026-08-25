import { Suspense } from "react";

import { parseSegment, type Pane } from "@/lib/panes";
import { PiecePane } from "./PiecePane";
import { PersonPane } from "./PersonPane";
import { WordPane } from "./WordPane";
import { NotFoundPane } from "./NotFoundPane";
import { PlaceholderPane } from "./PlaceholderPane";
import { IndexPane } from "./IndexPane";
import { PersonsPane } from "./PersonsPane";
import { WordsPane } from "./WordsPane";
import { AllPiecesPane } from "./AllPiecesPane";
import { GraphPane } from "./GraphPane";
import { ActionBar } from "@/components/ActionBar";

/**
 * One pane of the stack.
 *
 * Rendered from a nested layout, so it persists across navigation for as long
 * as its own segment is unchanged — that is what keeps a neighbour's link
 * click from tearing this pane down and losing its scroll position.
 *
 * Because it persists, it knows only its own segment and its position. It has
 * no idea what is in the panes beside it, and must not try to: everything
 * path-dependent is resolved by PaneLink on the client.
 */

function renderPane(pane: Pane, index: number) {
    switch (pane.kind) {
        case "piece":
            return <PiecePane page={pane.page} index={index} />;
        case "person":
            return <PersonPane slug={pane.slug} index={index} />;
        case "word":
            return <WordPane id={pane.id} index={index} />;

        case "index":
            return <IndexPane variant={pane.variant} index={index} />;
        case "persons":
            return <PersonsPane index={index} />;
        case "words":
            return <WordsPane index={index} />;
        case "all":
            return <AllPiecesPane index={index} />;
        case "graph":
            return <GraphPane index={index} />;

        case "edit-piece":
        case "edit-person":
        case "new-piece":
        case "new-person":
            return <PlaceholderPane label="editor" phase="Phase 5" />;

        case "notfound":
            return <NotFoundPane segment={pane.segment} />;
    }
}

export function PaneSlot({ segment, index }: { segment: string; index: number }) {
    const pane = parseSegment(segment);

    // The card toggle flips a piece between full and card form.
    const cardLink =
        pane.kind === "piece" ? (pane.card ? String(pane.page) : `${pane.page}c`) : undefined;
    const editTarget =
        pane.kind === "piece"
            ? `edit-${pane.page}`
            : pane.kind === "person"
              ? `edit-person-${pane.slug}`
              : undefined;

    return (
        <div className="pane">
            <div className="pane-scroll">
                <Suspense fallback={<div className="piece-title">⋅</div>}>
                    {renderPane(pane, index)}
                </Suspense>
            </div>
            <ActionBar index={index} cardLink={cardLink} editTarget={editTarget} loggedIn={false} />
        </div>
    );
}
