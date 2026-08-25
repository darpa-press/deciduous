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
 */
export function PaneBody({ segment, index }: { segment: string; index: number }) {
    const pane: Pane = parseSegment(segment);

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
