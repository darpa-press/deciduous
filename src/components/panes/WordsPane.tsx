import Link from "next/link";
import type { ReactNode } from "react";

import { getWordTree } from "@/lib/queries";
import { buildCreateLink } from "@/lib/panes";

/**
 * The word index. Synsets are arranged by hypernym, and each entry shows its
 * ancestry as a dimmed breadcrumb — so a word reads as "thing · plant · tree".
 * Ported from Pages/Index/IndexWord.
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
    createLink,
    ancestry,
}: {
    node: WordNode;
    createLink: (target: string) => string;
    ancestry: ReactNode;
}) {
    const label = (
        <>
            {ancestry}
            <span>{formatWord(node.word ?? "")}</span>
        </>
    );

    return (
        <div className="word-item">
            <div className="word-name">
                {node.id ? <Link href={createLink(`w-${node.id}`)}>{label}</Link> : <span>{label}</span>}
            </div>
            {node.children && node.children.length > 0 && (
                <div>
                    {node.children.map((child) => (
                        <WordEntry
                            key={String(child.id ?? child._id)}
                            node={child}
                            createLink={createLink}
                            ancestry={label}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export async function WordsPane({ pathArray, index }: { pathArray: string[]; index: number }) {
    const tree = (await getWordTree()) as unknown as WordNode[];
    const link = buildCreateLink(pathArray, index);
    const createLink = (target: string) => link(target, false);

    return (
        <div className="pane-inside words-list">
            {tree.map((bucket) => (
                <div key={bucket.word} className="mb-6">
                    <div className="font-display quiet mb-1">{bucket.word}</div>
                    {(bucket.children ?? []).map((node) => (
                        <WordEntry
                            key={String(node.id ?? node._id)}
                            node={node}
                            createLink={createLink}
                            ancestry={null}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
