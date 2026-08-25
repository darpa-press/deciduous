import Link from "next/link";

/**
 * The bar along the bottom of every pane.
 *
 * Left group is always present — index, graph, word calendar, people. Right
 * group is contextual: the card toggle for a piece, and the new/edit actions
 * once logged in.
 *
 * Its links are *not* contextual in the pane sense: the legacy component calls
 * createLink with one argument, so a bar action replaces the pane it belongs
 * to rather than the one beside it.
 *
 * The bar is 2.5rem tall, which is the height .pane-scroll subtracts from the
 * viewport.
 */

interface ActionBarProps {
    /** Non-contextual link factory for this pane. */
    createLink: (target: string) => string;
    /** Target for the card toggle, if this pane is a piece. */
    cardLink?: string;
    /** Target for the edit action, if this pane is editable. */
    editLink?: string;
    loggedIn?: boolean;
}

function Action({ href, label, icon }: { href: string; label: string; icon: string }) {
    return (
        <Link href={href} className="action-icon" data-label={label} aria-label={label}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/img/action/${icon}.png`} alt="" className="action-image" />
        </Link>
    );
}

export function ActionBar({ createLink, cardLink, editLink, loggedIn = false }: ActionBarProps) {
    return (
        <div className="action-bar">
            <div className="action-bar-inside">
                <div className="action-group">
                    <Action href={createLink("index")} label="Index" icon="icon-tree" />
                    <Action href={createLink("graph")} label="Graph" icon="icon-graph" />
                    <Action href={createLink("word")} label="Word calendar" icon="icon-word" />
                    <Action href={createLink("person")} label="People" icon="icon-persons" />
                </div>

                <div className="action-group">
                    {cardLink && <Action href={createLink(cardLink)} label="Card" icon="icon-card" />}
                    {loggedIn && <Action href={createLink("new")} label="New piece" icon="icon-new" />}
                    {loggedIn && editLink && <Action href={editLink} label="Edit" icon="icon-edit" />}
                </div>
            </div>
        </div>
    );
}
