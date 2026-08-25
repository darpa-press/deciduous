"use client";

import { useState } from "react";

import { PaneLink } from "@/components/PaneLink";

/**
 * The heading above a piece: the page number, swapping to the title on hover.
 * Ported from PieceViewIndex in PieceDumb.jsx.
 */
export function PieceTitle({
    page,
    title,
    target,
    index,
}: {
    page?: number;
    title?: string;
    target: string;
    index: number;
}) {
    const [hover, setHover] = useState(false);

    return (
        <h1 className="piece-title">
            <div onMouseOver={() => setHover(true)} onMouseOut={() => setHover(false)}>
                <PaneLink target={target} index={index}>
                    {hover ? title : page}
                </PaneLink>
            </div>
        </h1>
    );
}
