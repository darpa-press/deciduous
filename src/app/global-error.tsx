"use client";

/**
 * Replaces the root layout when the failure is the layout itself, so it has to
 * carry its own <html> and <body>. Deliberately unstyled — the stylesheet may
 * be exactly what did not load.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body style={{ fontFamily: "Georgia, serif", margin: "3rem auto", maxWidth: "32rem" }}>
                <p>Deciduous could not load.</p>
                {error.digest && <p style={{ opacity: 0.5 }}>Reference {error.digest}.</p>}
                <button type="button" onClick={reset}>
                    Try again
                </button>
            </body>
        </html>
    );
}
