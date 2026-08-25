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
