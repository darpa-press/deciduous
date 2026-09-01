import mongoose from "mongoose";

import { connect } from "@/lib/mongodb";
import { Piece } from "@/models/Piece";
import { Person } from "@/models/Person";

/**
 * Writing to the catalogue.
 *
 * Everything the editing actions do apart from the two things that only exist
 * inside the framework: the admin check and the cache tags. Those live in
 * app/editor-actions.ts, which is a thin skin over this.
 *
 * Split out because the invariants here are the ones most able to lose an
 * author's work — the version match that stops two tabs erasing each other,
 * the cycle walk that stops a piece being filed under itself — and a
 * "use server" module cannot be imported by a test at all: `next/headers`
 * needs a request scope and `updateTag` throws outside a Server Action.
 * Here they are ordinary functions over a database, and tests/editor.test.mts
 * exercises them directly.
 */

export interface PieceInput {
    id?: string | null;
    /** Document version the form was loaded from; guards against a lost update. */
    version?: number | null;
    title: string;
    content: string;
    readme: string;
    background: string;
    stub: boolean;
    fullWidth: boolean;
    parent: string | null;
    lovers: string[];
    persons: string[];
    word: string[];
}

export interface PersonInput {
    id?: string | null;
    /** Document version the form was loaded from; guards against a lost update. */
    version?: number | null;
    name: string;
    bio: string;
    birth: number | null;
    death: number | null;
    /** Wikidata item id the dates were looked up from, if a lookup filled them. */
    wikidata?: string;
    relation: { relatedPerson: string; relatedReason: string }[];
}

export const objectId = (value: string | null | undefined) =>
    value && mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;

export const objectIds = (values: string[] | undefined) =>
    (values ?? []).map(objectId).filter((id): id is mongoose.Types.ObjectId => id !== null);

export const STALE =
    "This was edited somewhere else since you opened it. Reload the pane and reapply your change.";

/**
 * Match on the version the form was loaded with, and bump it on write.
 *
 * The update used to be a blind $set of every field, over a snapshot taken
 * whenever the pane last rendered — which can be a long time, since panes do
 * not refetch on their own. Two tabs on the same piece meant the second save
 * silently erased the first, with nothing shown to either. A version that does
 * not match now fails the edit rather than the other author's work.
 */
export const versioned = (id: string, version: number | null | undefined) =>
    version == null ? { _id: id } : { _id: id, __v: version };

/**
 * Would filing `id` under `parent` put it in a loop?
 *
 * Walks up from the proposed parent looking for the piece itself. Bounded by a
 * hop count as well as the answer, so a loop that is already in the data
 * cannot spin here.
 */
export async function wouldCycle(
    id: string | null | undefined,
    parent: mongoose.Types.ObjectId | null
): Promise<boolean> {
    if (!id || !parent) return false;
    if (String(parent) === String(id)) return true;

    let current: mongoose.Types.ObjectId | null = parent;

    for (let hops = 0; current && hops < 64; hops++) {
        const ancestor: { parent?: mongoose.Types.ObjectId | null } | null = await Piece.findById(
            current
        )
            .select("parent")
            .lean();
        if (!ancestor?.parent) return false;
        if (String(ancestor.parent) === String(id)) return true;
        current = ancestor.parent;
    }

    return true;
}

/** Returns the page number to navigate to. */
export async function savePiece(input: PieceInput): Promise<{ page: number }> {
    await connect();

    const parent = objectId(input.parent);

    const doc = {
        title: input.title,
        content: input.content,
        readme: input.readme,
        background: input.background,
        stub: Boolean(input.stub),
        fullWidth: Boolean(input.fullWidth),
        // A piece that is its own ancestor is filed as its own child and never
        // reaches the index tree — it and everything beneath it disappear from
        // the site's main navigation with no error. The editor no longer offers
        // the piece itself, and the walk below covers the longer loops it
        // cannot see.
        parent: (await wouldCycle(input.id, parent)) ? null : parent,
        lovers: objectIds(input.lovers),
        persons: objectIds(input.persons),
        word: input.word ?? [],
    };

    if (input.id) {
        // findOneAndUpdate, as the legacy controller did — which means the
        // pre-save hooks do not run and the slug is left alone on edit.
        const updated = await Piece.findOneAndUpdate(
            versioned(input.id, input.version),
            { ...doc, $inc: { __v: 1 } },
            { new: true, runValidators: true }
        ).exec();
        if (!updated) {
            const exists = await Piece.exists({ _id: input.id });
            throw new Error(exists ? STALE : "That piece no longer exists.");
        }
        return { page: updated.page ?? 0 };
    }

    // A new document goes through save(), so it gets its page number from the
    // counter and its slug from the title.
    const created = await new Piece(doc).save();
    return { page: created.page ?? 0 };
}

export async function deletePiece(id: string): Promise<void> {
    await connect();
    await Piece.deleteOne({ _id: id });
}

/** Returns the slug to navigate to. */
export async function savePerson(input: PersonInput): Promise<{ slug: string }> {
    await connect();

    const doc = {
        name: input.name,
        bio: input.bio,
        birth: input.birth,
        death: input.death,
        // null rather than undefined, so the field tracks the form the way
        // birth and death do — Mongoose skips an undefined path on update.
        wikidata: input.wikidata || null,
        relation: (input.relation ?? [])
            .filter((entry) => entry.relatedPerson)
            .map((entry) => ({
                relatedPerson: objectId(entry.relatedPerson),
                relatedReason: entry.relatedReason,
            })),
    };

    if (input.id) {
        const updated = await Person.findOneAndUpdate(
            versioned(input.id, input.version),
            { ...doc, $inc: { __v: 1 } },
            { new: true, runValidators: true }
        ).exec();
        if (!updated) {
            const exists = await Person.exists({ _id: input.id });
            throw new Error(exists ? STALE : "That person no longer exists.");
        }
        return { slug: updated.slug ?? "" };
    }

    const created = await new Person(doc).save();
    return { slug: created.slug ?? "" };
}

/** The much smaller person the piece editor can write: who, and when. */
export interface PersonDraft {
    name: string;
    birth: number | null;
    death: number | null;
    wikidata?: string;
}

/**
 * Create a person from the piece editor.
 *
 * Name and dates only — the piece editor is not the place to write a bio or
 * work out relations, and the person's own editor is one pane away once they
 * exist. Returns the option the caller should select, and whether it was
 * actually new.
 */
export async function createPerson(
    input: PersonDraft
): Promise<{ id: string; name: string; created: boolean }> {
    await connect();

    const name = input.name.trim();
    if (!name) throw new Error("A person needs a name.");

    // Two people may legitimately share a name, but here the name is nearly all
    // the author gave us — a second record differing only in case is impossible
    // to tell from the first in the option list, so reuse the one that exists.
    // Their own dates are left alone: this form is not where they get revised.
    const existing = await Person.findOne({
        name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    })
        .select("name")
        .lean();
    if (existing) {
        return { id: String(existing._id), name: existing.name ?? name, created: false };
    }

    const created = await new Person({
        name,
        birth: input.birth,
        death: input.death,
        wikidata: input.wikidata || undefined,
    }).save();
    return { id: String(created._id), name: created.name, created: true };
}

export async function deletePerson(id: string): Promise<void> {
    await connect();
    await Person.deleteOne({ _id: id });
}
