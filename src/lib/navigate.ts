/**
 * Pane navigation.
 *
 * Uses history.pushState rather than the Next router deliberately. A router
 * navigation re-renders the matched route, which rebuilds panes that did not
 * change; pushState moves the URL and `usePathname` without touching the
 * route, so only the pane whose segment changed does any work.
 *
 * Next integrates pushState into its router, so usePathname stays in sync and
 * back/forward keep working.
 */
export function pushPane(href: string) {
    if (typeof window === "undefined") return;
    if (window.location.pathname === href) return;
    window.history.pushState(null, "", href);
}

/**
 * An Option/Alt click with nothing else held.
 *
 * The gesture for "put this in the *other* pane": a link that would normally
 * write over its own pane writes over the one next door, and vice versa. It is
 * checked before isModifiedClick, which would otherwise hand the click to the
 * browser — where Option-click means download, which is never what a link in
 * the codex wants.
 */
export function isOtherPaneClick(event: {
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    button: number;
}) {
    return (
        event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0
    );
}

/** True for clicks the browser should handle itself — new tab, download, etc. */
export function isModifiedClick(event: {
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    button: number;
}) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}
