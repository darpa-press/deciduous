import fontColorContrast from "font-color-contrast";

import { renderContent } from "@/lib/content/render";
import { PieceTitle } from "./PieceTitle";

export interface PieceLike {
    page?: number;
    title?: string;
    content?: string | null;
    background?: string;
    fullWidth?: boolean;
}

/**
 * Presentational body of a piece. Shared by the piece pane and by the panes
 * that list pieces inline — the same split the legacy app made with
 * PieceViewDumb.
 */
export function PieceBody({
    piece,
    index,
    isInList = false,
}: {
    piece: PieceLike;
    index: number;
    /**
     * In a list, the heading links to the piece itself; standalone, it links
     * to the index.
     */
    isInList?: boolean;
}) {
    const background = piece.background;

    // Text colour is derived from the piece's own background so light-on-dark
    // stays readable. The #000000 -> #333 step is the legacy "monkey patch the
    // contrast result" and is kept deliberately — it is what every dark-text
    // piece currently renders as.
    let textColor: string | false =
        background && background !== "" ? fontColorContrast(background) : false;
    if (textColor === "#000000") textColor = "#333";

    return (
        <div
            className={`piece ${textColor === "#ffffff" ? "piece--text-light" : "piece--text-dark"}`}
            style={{
                backgroundColor: background || undefined,
                color: textColor || undefined,
            }}
        >
            <PieceTitle
                page={piece.page}
                title={piece.title}
                target={isInList ? String(piece.page) : "index"}
                index={index}
            />

            <div className={`piece-content ${piece.fullWidth ? "piece__full" : ""}`}>
                <div>{renderContent(piece.content, index)}</div>
            </div>
        </div>
    );
}
