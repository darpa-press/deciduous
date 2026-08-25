import type { ReactNode } from "react";

import { getWordTree } from "@/lib/queries";
import { PaneLink } from "@/components/PaneLink";

/**
 * The word index. Synsets are arranged by hypernym, and each entry carries its
 * ancestry as a dimmed breadcrumb — so a nested word reads as
 * "Things · Plant · Tree" with only the last at full strength.
 *
 * Two details are inherited from the legacy client rather than the API:
 *
 *   1. The three buckets are sorted alphabetically by name — acts, qualities,
 *      things — not left in the order /api/word returns them. The sort happens
 *      in common/api/word.js, after the fetch.
 *   2. A bucket is rendered as a word entry like any other, not as a heading,
 *      so its name becomes the first crumb in every descendant's ancestry.
 */

interface WordNode {
    id?: string;
    _id?: string;
    word?: string;
    pos?: string;
    children?: WordNode[];
}

/** Underscores are WordNet's word separator. */
function formatWord(word: string) {
    const spaced = word.replace(/_/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function WordEntry({
    node,
    index,
    ancestry,
}: {
    node: WordNode;
    index: number;
    ancestry: ReactNode;
}) {
    // The label is ancestry plus this word, and is passed down whole as the
    // next level's ancestry — which is how the breadcrumb accumulates.
    const label = (
        <>
            {ancestry}
            <span>{formatWord(node.word ?? "")}</span>
        </>
    );

    return (
        <div className="word-item">
            <div className="word-name">
                <PaneLink target={`w-${node.id ?? ""}`} index={index}>
                    {label}
                </PaneLink>
            </div>
            <div>
                {(node.children ?? []).map((child) => (
                    <WordEntry
                        key={String(child.id ?? child._id)}
                        node={child}
                        index={index}
                        ancestry={label}
                    />
                ))}
            </div>
        </div>
    );
}

export async function WordsPane({ index }: { index: number }) {
    const tree = (await getWordTree()) as unknown as WordNode[];

    // Matches the sort in common/api/word.js: `a.word > b.word ? 1 : -1`.
    const sorted = [...tree].sort((a, b) => ((a.word ?? "") > (b.word ?? "") ? 1 : -1));

    return (
        <div className="pane-inside words-list">
            {sorted.map((bucket) => (
                <WordEntry key={bucket.word} node={bucket} index={index} ancestry={null} />
            ))}
        </div>
    );
}
