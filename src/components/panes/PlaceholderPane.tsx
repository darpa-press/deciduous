/**
 * Panes that arrive in Phase 4 (index, graph, listings) and Phase 5 (editors).
 * Rendering a labelled placeholder rather than a 404 keeps the pane grammar
 * exercisable end to end while those are built.
 */
export function PlaceholderPane({ label, phase }: { label: string; phase: string }) {
    return (
        <div className="piece">
            <h1 className="piece-title">
                <div>{label}</div>
            </h1>
            <div className="piece-content">
                <div className="system-font quiet">Arrives in {phase}.</div>
            </div>
        </div>
    );
}
