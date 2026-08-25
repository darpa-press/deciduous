import mongoose, { Schema, type Model } from "mongoose";

/**
 * A WordNet synset, mirroring WordNet's own structure. Ported from
 * backend/models/Word.js — which ended with `mongoose.exports = ...` instead of
 * `module.exports`, a typo that only went unnoticed because every caller
 * reached the model via `mongoose.model("Word")` after requiring the file for
 * its side effect.
 *
 * `_id` is a string of the form `{synsetOffset}{pos}` (e.g. "407535n"), not an
 * ObjectId, so autopopulated ids are disabled.
 */

export interface PointerDoc {
    pointerSymbol?: string;
    synsetOffset?: number;
    pos?: string;
    sourceTarget?: string;
}

export interface WordDoc {
    _id: string;
    word?: string;
    synsetOffset?: number;
    lexFilenum?: number;
    pos?: string;
    wCnt?: number;
    lemma?: string;
    synonyms: string[];
    lexId?: string;
    ptrs: PointerDoc[];
    gloss?: string;
    def?: string;
    exp: string[];
    parent?: string | null;
}

const pointerSchema = new Schema<PointerDoc>(
    {
        pointerSymbol: String,
        synsetOffset: Number,
        pos: String,
        sourceTarget: String,
    },
    { _id: false }
);

const wordSchema = new Schema<WordDoc>({
    _id: { type: String },
    word: { type: String },
    synsetOffset: { type: Number },
    lexFilenum: { type: Number },
    pos: { type: String },
    wCnt: { type: Number },
    lemma: { type: String },
    synonyms: { type: [String] },
    lexId: { type: String },
    ptrs: { type: [pointerSchema] },
    gloss: { type: String },
    def: { type: String },
    exp: { type: [String] },
    parent: { type: String, ref: "Word" },
});

export const Word: Model<WordDoc> =
    (mongoose.models.Word as Model<WordDoc>) ?? mongoose.model<WordDoc>("Word", wordSchema);
