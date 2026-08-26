import mongoose, { Schema, type Model, type Types } from "mongoose";
import slug from "slugs";
import { uniqueSlug } from "@/lib/unique-slug";
import { nextPage, raiseCounterTo } from "@/lib/page-counter";

/**
 * The main codex document. Ported from backend/models/Piece.js.
 *
 * `page` is the public permalink (`/125`), assigned by the counter in
 * lib/page-counter.ts — see there for why the semantics matter.
 */

export interface PieceDoc {
    _id: Types.ObjectId;
    background?: string;
    title: string;
    slug?: string;
    page?: number;
    content?: string;
    created: Date;
    stub: boolean;
    fullWidth: boolean;
    parent?: Types.ObjectId | null;
    persons: Types.ObjectId[];
    lovers: Types.ObjectId[];
    readme?: string;
    word: string[];
    /**
     * Vestigial. Not in the legacy schema, but present on 106 of 118 stored
     * documents (always an empty array) and therefore present in the live API
     * responses, because Mongoose passes unknown stored paths through. Declared
     * with `default: undefined` so it is never *added* to a document that does
     * not already have it — twelve documents omit it and the API omits it for
     * those too.
     */
    themes?: unknown[];
}

const pieceSchema = new Schema<PieceDoc>({
    background: { type: String, trim: true },
    title: { type: String, trim: true, required: [true, "Please enter a title."] },
    slug: { type: String },
    page: { type: Number },
    content: { type: String, trim: true },
    created: { type: Date, default: Date.now },
    stub: { type: Boolean, default: false },
    fullWidth: { type: Boolean, default: false },
    parent: { type: Schema.Types.ObjectId, ref: "Piece" },
    persons: [{ type: Schema.Types.ObjectId, ref: "Person" }],
    lovers: [{ type: Schema.Types.ObjectId, ref: "Piece" }],
    readme: { type: String, trim: true },
    word: { type: [String] },
    themes: { type: [Schema.Types.Mixed], default: undefined },
});

// Full-text search index, matching the one on the live collection.
pieceSchema.index({ content: "text", title: "text", readme: "text" });

// `page` is the permalink — every pane render looks a piece up by it, and
// without this that is a collection scan. The rest back the index tree, the
// person pane and the word pane, which all filter on them.
pieceSchema.index({ page: 1 });
pieceSchema.index({ slug: 1 });
pieceSchema.index({ parent: 1 });
pieceSchema.index({ persons: 1 });
pieceSchema.index({ word: 1 });

// Assign the page number on insert. Replaces mongoose-auto-increment-fix.
pieceSchema.pre("save", async function (next) {
    if (!this.isNew) return next();

    if (typeof this.page === "number") {
        // An explicit page was supplied — keep it, but make sure the counter
        // never hands the same number out again.
        await raiseCounterTo(this.page);
    } else {
        this.page = await nextPage();
    }

    next();
});

// Slug from title, de-duplicated with a numeric suffix.
pieceSchema.pre("save", async function (next) {
    if (!this.isModified("title")) return next();

    this.slug = await uniqueSlug(
        this.constructor as Model<PieceDoc>,
        slug(this.title),
        this._id
    );

    next();
});

export const Piece: Model<PieceDoc> =
    (mongoose.models.Piece as Model<PieceDoc>) ?? mongoose.model<PieceDoc>("Piece", pieceSchema);
