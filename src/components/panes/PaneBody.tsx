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

/**
 * The contents of one pane, chosen by its segment. No chrome, no wrapper —
 * PaneHost provides those — so that this can be rendered either with the page
 * or later, on its own, by the pane action.
 *
 * `loggedIn` arrives as a prop rather than being read here. Reading cookies
 * inside this component would make every pane a dynamic hole, and content
 * inside such a hole never hydrates: the server markup arrives, then the
 * client replaces it with the Suspense fallback.
 */
export function PaneBody({
    segment,
    index,
    loggedIn = false,
}: {
    segment: string;
    index: number;
    loggedIn?: boolean;
}) {
    const pane: Pane = parseSegment(segment);

    switch (pane.kind) {
        case "piece":
            return <PiecePane page={pane.page} index={index} card={pane.card} />;
        case "person":
            return <PersonPane slug={pane.slug} index={index} />;
        case "word":
            return <WordPane id={pane.id} index={index} />;
        case "index":
            return <IndexPane variant={pane.variant} index={index} loggedIn={loggedIn} />;
        case "persons":
            return <PersonsPane index={index} />;
        case "words":
            return <WordsPane index={index} />;
        case "all":
            return <AllPiecesPane index={index} />;
        case "graph":
            return <GraphPane index={index} />;
        // Editors are admin-only. Logged out, the segment simply does not
        // resolve — the same as any other unknown path.
        case "edit-piece":
        case "edit-person":
        case "new-piece":
        case "new-person":
            if (!loggedIn) return <NotFoundPane segment={segment} />;
            return <PlaceholderPane label="editor" phase="Phase 5" />;
        case "notfound":
            return <NotFoundPane segment={pane.segment} />;
    }
}
