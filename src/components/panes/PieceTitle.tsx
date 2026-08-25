"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * The heading above a piece. It shows the page number, and swaps to the title
 * on hover — a small piece of the codex's character, ported as-is from
 * PieceViewIndex in PieceDumb.jsx.
 */
export function PieceTitle({ page, title, href }: { page?: number; title?: string; href: string }) {
    const [hover, setHover] = useState(false);

    return (
        <h1 className="piece-title">
            <div>
                <Link
                    href={href}
                    onMouseOver={() => setHover(true)}
                    onMouseOut={() => setHover(false)}
                >
                    {hover ? title : page}
                </Link>
            </div>
        </h1>
    );
}
