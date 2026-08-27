"use server";

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
        // `word` is set only by $setOnInsert below, so it must not also appear
        // in the spread — the two would conflict on the same path.
        const { word: _ignored, ...fields } = synset;
        void _ignored;

        await Word.findOneAndUpdate(
            { _id: synsetId(synset) },
            {
                ...fields,
                _id: synsetId(synset),
                parent,
                // Ancestors are filed under their lemma — but only when they
                // are new. Writing it unconditionally meant a synset already
                // stored under the term its author searched for got silently
                // relabelled the next time it turned up as somebody else's
                // hypernym.
                $setOnInsert: { word: synset.lemma },
            },
            { new: true, upsert: true, runValidators: true }
        ).exec();
    }

    const stored = await Word.findOneAndUpdate(
        { _id: id },
        {
            ...chosen,
            _id: id,
            // The searched term, not the lemma. `lemma` is always present on a
            // lookup result, so `chosen.lemma ?? term` never once reached the
            // fallback — search "autumn", attach the season, and the chip and
            // the printed index both read "fall".
            word: term || chosen.lemma,
            parent: ancestors.length ? synsetId(ancestors[0]) : null,
        },
        { new: true, upsert: true, runValidators: true }
    ).exec();

    // Deliberately no updateTag here — see savePiece, which carries "words"
    // instead.
    //
    // updateTag refreshes the route as part of the action's response, and this
    // is the one editing action that leaves the pane where it is. The refresh
    // then rendered the whole page a second time into the body: two pane
    // stacks, the fresh one on top showing what is stored and the one being
    // typed into pushed below the fold. Attaching a word looked like the editor
    // resetting itself, and the author's unsaved work was one scroll away but
    // effectively gone. Saving does not do this — it pushes the pane to the
    // piece first, so there is nothing left for the refresh to collide with.
    //
    // Nothing on screen is stale in the meantime, either. A synset attached
    // here is not linked to anything until the piece is saved, and that is what
    // puts it in the word tree.

    return stored ? toResult(chosen, term) : null;
}
