import { getPieceTree, getAllPieces } from "@/lib/queries";
import { PaneLink } from "@/components/PaneLink";

/**
 * The piece index, in two forms: the hierarchy (`/index`) and the alphabetical
 * listing (`/index-a`). Ported from Pages/Index/IndexPiece.
 *
 * Index links are *not* contextual — the legacy component calls createLink with
 * one argument, so clicking an entry replaces the index pane itself rather than
 * the pane next door. Preserved deliberately.
 */

interface TreeNode {
    _id: unknown;
    page?: number;
    title?: string;
    stub?: boolean;
    children?: TreeNode[];
}

function IndexEntry({
    node,
    index,
    loggedIn,
}: {
    node: TreeNode;
    index: number;
    loggedIn: boolean;
}) {
    const linkable = !node.stub || loggedIn;

    const label = (
        <>
            {node.title}
            <span className="index-number">{node.page}</span>
        </>
    );

    return (
        <div className="index-item">
            <div className={`index-link ${node.stub ? "quiet" : ""}`}>
                {linkable ? (
                    <PaneLink
                        target={String(node.page)}
                        index={index}
                        style={{ opacity: node.stub ? 0.5 : 1 }}
                    >
                        {label}
                    </PaneLink>
                ) : (
                    <span>{label}</span>
                )}
            </div>

            {node.children && node.children.length > 0 && (
                <div className="index-children">
                    {node.children.map((child) => (
                        <IndexEntry
                            key={String(child._id)}
                            node={child}
                            index={index}
                            loggedIn={loggedIn}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

async function IndexTree({ index, loggedIn }: { index: number; loggedIn: boolean }) {
    const tree = (await getPieceTree()) as unknown as TreeNode[];
    return (
        <div className="pane-inside">
            {tree.map((node) => (
                <IndexEntry key={String(node._id)} node={node} index={index} loggedIn={loggedIn} />
            ))}
        </div>
    );
}

async function IndexAlpha({ index }: { index: number }) {
    const pieces = await getAllPieces({ sort: "title", order: 1 });

    // Grouped by first letter of the title, in the order the sorted list
    // produces them — same as the legacy sortPieces().
    const byLetter = new Map<string, typeof pieces>();
    for (const piece of pieces) {
        const letter = String(piece.title ?? "").substring(0, 1).toUpperCase();
        const bucket = byLetter.get(letter);
        if (bucket) bucket.push(piece);
        else byLetter.set(letter, [piece]);
    }

    return (
        <div className="pane-inside">
            {[...byLetter.entries()].map(([letter, group]) => (
                <div className="index-alpha-row" key={letter}>
                    <div className="index-alpha-letter">{letter}</div>
                    <div>
                        {group.map((piece) => (
                            <div className="index-alpha-piece" key={String(piece._id)}>
                                <PaneLink target={String(piece.page)} index={index}>
                                    {piece.title}
                                </PaneLink>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export async function IndexPane({
    variant,
    index,
    loggedIn = false,
}: {
    variant: "tree" | "alpha";
    index: number;
    loggedIn?: boolean;
}) {
    return (
        <div>
            <div className="index-types">
                <PaneLink
                    target="index"
                    index={index}
                    className={variant === "tree" ? "" : "quiet"}
                    aria-label="Tree index"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/img/icon-tree.svg" alt="tree" className="index-type-icon" />
                </PaneLink>
                <PaneLink
                    target="index-a"
                    index={index}
                    className={variant === "alpha" ? "" : "quiet"}
                    aria-label="Alphabetical index"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/img/icon-alpha.svg" alt="alpha" className="index-type-icon" />
                </PaneLink>
            </div>

            {variant === "tree" ? (
                <IndexTree index={index} loggedIn={loggedIn} />
            ) : (
                <IndexAlpha index={index} />
            )}
        </div>
    );
}
