import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";

import "@/styles/content.css";
import { parseSegment, HOME_PANES, type Pane } from "@/lib/panes";
import { INDEX_SENTINEL } from "@/proxy";
import { PiecePane } from "@/components/panes/PiecePane";
import { PersonPane } from "@/components/panes/PersonPane";
import { WordPane } from "@/components/panes/WordPane";
import { NotFoundPane } from "@/components/panes/NotFoundPane";
import { PlaceholderPane } from "@/components/panes/PlaceholderPane";
import { IndexPane } from "@/components/panes/IndexPane";
import { PersonsPane } from "@/components/panes/PersonsPane";
import { WordsPane } from "@/components/panes/WordsPane";
import { AllPiecesPane } from "@/components/panes/AllPiecesPane";
import { GraphPane } from "@/components/panes/GraphPane";
import { getPieceByPage } from "@/lib/queries";

/**
 * The pane stack.
 *
 * Every path segment is an independent pane: `/2/125` is piece 2 beside piece
 * 125, `/index/p-someone` is the index beside a person. The whole app is this
 * one route.
 *
 * Because it *is* one route, navigating from `/2` to `/2/125` reconciles
 * rather than remounts, so an unchanged pane keeps its scroll position —
 * behaviour the legacy app had to arrange by hand. Each pane is its own async
 * server component under its own Suspense boundary, so a slow pane streams in
 * without holding up its neighbour.
 */

export const dynamic = "force-dynamic";

function renderPane(pane: Pane, pathArray: string[], index: number) {
    switch (pane.kind) {
        case "piece":
            return <PiecePane page={pane.page} pathArray={pathArray} index={index} />;
        case "person":
            return <PersonPane slug={pane.slug} pathArray={pathArray} index={index} />;
        case "word":
            return <WordPane id={pane.id} pathArray={pathArray} index={index} />;

        case "index":
            return <IndexPane variant={pane.variant} pathArray={pathArray} index={index} />;
        case "persons":
            return <PersonsPane pathArray={pathArray} index={index} />;
        case "words":
            return <WordsPane pathArray={pathArray} index={index} />;
        case "all":
            return <AllPiecesPane pathArray={pathArray} index={index} />;
        case "graph":
            return <GraphPane pathArray={pathArray} index={index} />;

        case "edit-piece":
        case "edit-person":
        case "new-piece":
        case "new-person":
            return <PlaceholderPane label="editor" phase="Phase 5" />;

        case "notfound":
            return <NotFoundPane segment={pane.segment} />;
    }
}

/**
 * `/index` reaches this route rewritten as `/__pane/index` — see src/proxy.ts.
 * The sentinel is stripped here so the pane stack, and every link built from
 * it, sees the path the visitor actually typed.
 */
function stripSentinel(segments: string[]): string[] {
    return segments[0] === INDEX_SENTINEL ? segments.slice(1) : segments;
}

export async function generateMetadata({
    params,
}: PageProps<"/[[...panes]]">): Promise<Metadata> {
    const { panes } = await params;
    const segments = stripSentinel(panes ?? []);

    // The legacy app assembled the document title from every pane, falling back
    // to a middle dot for panes that had not resolved.
    const titles = await Promise.all(
        segments.map(async (segment) => {
            const pane = parseSegment(segment);
            if (pane.kind === "piece") {
                const piece = await getPieceByPage(pane.page);
                return piece?.title ?? "⋅";
            }
            if (pane.kind === "index") return "Index";
            if (pane.kind === "persons") return "People";
            if (pane.kind === "words") return "Words";
            if (pane.kind === "graph") return "Graph";
            return segment;
        })
    );

    return { title: titles.length ? `${titles.join(" · ")} — Deciduous` : "Deciduous" };
}

export default async function PanesPage({ params }: PageProps<"/[[...panes]]">) {
    const { panes } = await params;
    const pathArray = stripSentinel(panes ?? []);

    // `/` opened on this pair in the legacy app.
    if (pathArray.length === 0) redirect(`/${HOME_PANES.join("/")}`);

    return (
        <div className="pane-container">
            {pathArray.map((segment, index) => {
                const pane = parseSegment(segment);
                return (
                    // Keyed by segment so an unchanged pane is reconciled rather
                    // than remounted, preserving its scroll position.
                    <div className="pane" key={`${index}-${segment}`}>
                        <div className="pane-scroll">
                            <Suspense fallback={<div className="piece-title">⋅</div>}>
                                {renderPane(pane, pathArray, index)}
                            </Suspense>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
