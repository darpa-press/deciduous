"use client";

/**
 * Last line of defence for a pane that throws while rendering.
 *
 * Piece content is stored HTML and rendered synchronously, so a single
 * malformed value in one document used to take the whole route down with a
 * framework stack trace. The codex should lose the piece, not the page.
 */
export default function PaneError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="pane-container">
            <div className="pane">
                <div className="pane-scroll">
                    <div className="pane-inside">
                        <p>This page could not be rendered.</p>
                        <p className="quiet">
                            {error.digest
                                ? `Reference ${error.digest}.`
                                : "Something in its stored content is malformed."}
                        </p>
                        <button type="button" onClick={reset}>
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
