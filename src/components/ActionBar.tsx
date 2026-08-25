import { PaneLink } from "@/components/PaneLink";

/**
 * The bar along the bottom of every pane.
 *
 * Left group is always present — index, graph, word calendar, people. Right
 * group is contextual: the card toggle for a piece, and new/edit once logged
 * in.
 *
 * Bar actions are not contextual in the pane sense: they replace the pane they
 * belong to, not the one beside it. The bar is 2.5rem tall, which is what
 * .pane-scroll subtracts from the viewport.
 */

function Action({
    target,
    index,
    label,
    icon,
}: {
    target: string;
    index: number;
    label: string;
    icon: string;
}) {
    return (
        <PaneLink target={target} index={index} className="action-icon" aria-label={label}>
            {/* Shown on hover; see .action-tip in content.css. */}
            <span className="action-tip">{label}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/img/action/${icon}.png`} alt="" className="action-image" />
        </PaneLink>
    );
}

export function ActionBar({
    index,
    cardLink,
    editTarget,
    loggedIn = false,
}: {
    index: number;
    cardLink?: string;
    editTarget?: string;
    loggedIn?: boolean;
}) {
    return (
        <div className="action-bar">
            <div className="action-bar-inside">
                <div className="action-group">
                    <Action target="index" index={index} label="Index" icon="icon-tree" />
                    <Action target="graph" index={index} label="Graph" icon="icon-graph" />
                    <Action target="word" index={index} label="Word calendar" icon="icon-word" />
                    <Action target="person" index={index} label="People" icon="icon-persons" />
                </div>

                <div className="action-group">
                    {cardLink && <Action target={cardLink} index={index} label="Card" icon="icon-card" />}
                    {loggedIn && <Action target="new" index={index} label="New piece" icon="icon-new" />}
                    {loggedIn && editTarget && (
                        <Action target={editTarget} index={index} label="Edit" icon="icon-edit" />
                    )}
                </div>
            </div>
        </div>
    );
}
