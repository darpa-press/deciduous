"use server";

import { updateTag } from "next/cache";

import { connect } from "@/lib/mongodb";
import { Word } from "@/models/Word";
import { requireAdmin } from "@/lib/auth/session";
import { lookup, hypernymChain, synsetId, type Synset } from "@/lib/wordnet";

/**
 * Attaching WordNet synsets to a piece.
 *
 * Looking a word up hits WordNet; attaching one stores it, and its hypernym
 * chain, in the `words` collection — which is what makes the word index a tree
 * rather than a flat list, and what lets ordinary reading never touch WordNet
 * at all.
 */

export interface WordResult {
    id: string;
    word: string;
    pos: string;
    gloss: string;
    synsetOffset: number;
}

const toResult = (synset: Synset, term: string): WordResult => ({
    id: synsetId(synset),
    word: synset.lemma ?? term,
    pos: synset.pos ?? "",
    gloss: synset.gloss ?? "",
    synsetOffset: synset.synsetOffset,
});

export async function lookupWord(term: string): Promise<WordResult[]> {
    await requireAdmin();
    const synsets = await lookup(term);
    return synsets.map((synset) => toResult(synset, term));
}

/**
 * Store a synset and its hypernyms, then return the stored form.
 *
 * Each is upserted by its `{offset}{pos}` id and linked to its parent, so
 * attaching "tree" also files "plant", "organism" and so on above it. Ported
 * from createWord in wordController.
 */
export async function attachWord(term: string, id: string): Promise<WordResult | null> {
    await requireAdmin();
    await connect();

    const synsets = await lookup(term);
    const chosen = synsets.find((synset) => synsetId(synset) === id);
    if (!chosen) return null;

    const ancestors = await hypernymChain(chosen);

    // Store deepest ancestor first, so every parent exists before its child
    // points at it.
    for (let i = ancestors.length - 1; i >= 0; i--) {
        const synset = ancestors[i];
        const parent = i + 1 < ancestors.length ? synsetId(ancestors[i + 1]) : null;
        await Word.findOneAndUpdate(
            { _id: synsetId(synset) },
            {
                ...synset,
                _id: synsetId(synset),
                // Ancestors are filed under their lemma; only the chosen synset
                // keeps the term the author actually searched for.
                word: synset.lemma,
                parent,
            },
            { new: true, upsert: true, runValidators: true }
        ).exec();
    }

    const stored = await Word.findOneAndUpdate(
        { _id: id },
        {
            ...chosen,
            _id: id,
            word: chosen.lemma ?? term,
            parent: ancestors.length ? synsetId(ancestors[0]) : null,
        },
        { new: true, upsert: true, runValidators: true }
    ).exec();

    updateTag("words");
    updateTag(`word-${id}`);

    return stored ? toResult(chosen, term) : null;
}
