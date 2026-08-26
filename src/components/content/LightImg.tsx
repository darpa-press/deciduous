"use client";

import { useEffect, useState } from "react";

/**
 * `<lightimg>` — an image that opens into a full-screen lightbox on click.
 * The most-used custom element in the codex (39 uses across 36 pieces).
 *
 * Ported from Plugins/LightImg. The styled-components/transition-group stack is
 * replaced with Tailwind and a plain fade; the behaviour — click to open, click
 * anywhere to close, optional `bg` backdrop colour — is unchanged.
 */
export function LightImg({
    src,
    width,
    height,
    bg,
    className,
    title,
    alt = "",
    style,
}: {
    src?: string;
    width?: string | number;
    height?: string | number;
    bg?: string;
    className?: string;
    title?: string;
    alt?: string;
    /** The allowlist keeps `style` on <lightimg>; honour it rather than drop it. */
    style?: React.CSSProperties;
}) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <span className="mb-8 block">
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
                aria-label={alt || title || "Open image"}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={src}
                    alt={alt}
                    width={width}
                    height={height}
                    title={title}
                    className={`${className ?? ""} mb-0 max-w-full align-bottom`}
                    style={{ backgroundColor: "rgba(0,0,0,0.02)", ...(style ?? {}) }}
                />
            </button>

            {open && (
                <span
                    role="presentation"
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-100 flex h-full w-full items-center justify-center"
                    style={{ backgroundColor: bg || "rgba(255,255,255,0.999)" }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={alt} className="h-auto max-h-[95vh] w-auto max-w-[95vw]" />
                </span>
            )}
        </span>
    );
}
