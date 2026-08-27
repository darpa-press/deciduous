"use server";

import { updateTag } from "next/cache";
import mongoose from "mongoose";

import { connect } from "@/lib/mongodb";
import { Piece } from "@/models/Piece";
import { Person } from "@/models/Person";
import { requireAdmin } from "@/lib/auth/session";

/**
 * Editing actions.
 *
 * Every one begins with requireAdmin. Server Actions are reachable by anyone
 * who can find their id, so the check belongs here rather than in the route
 * that renders the form — a gated editor is not a gated mutation.
 *
 * Each mutation calls updateTag on the tags its data is read under. updateTag
 * rather than revalidateTag: the author must see their own edit immediately,
 * and revalidateTag's stale-while-revalidate would show them the previous
 * version straight after saving it.
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
    relation: { relatedPerson: string; relatedReason: string }[];
}

const objectId = (value: string | null | undefined) =>
    value && mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;

const objectIds = (values: string[] | undefined) =>
    (values ?? []).map(objectId).filter((id): id is mongoose.Types.ObjectId => id !== null);

const STALE =
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
const versioned = (id: string, version: number | null | undefined) =>
    version == null ? { _id: id } : { _id: id, __v: version };

/**
 * Would filing `id` under `parent` put it in a loop?
 *
 * Walks up from the proposed parent looking for the piece itself. Bounded by a
 * hop count as well as the answer, so a loop that is already in the data
 * cannot spin here.
 */
async function wouldCycle(
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
    await requireAdmin();
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

    let page: number;

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
        page = updated.page ?? 0;
    } else {
        // A new document goes through save(), so it gets its page number from
        // the counter and its slug from the title.
        const created = await new Piece(doc).save();
        page = created.page ?? 0;
    }

    updateTag("pieces");
    updateTag(`piece-${page}`);
    // The piece's word links are written here, and attachWord deliberately
    // leaves the tag alone — refreshing the route from under an open editor
    // rendered the page twice. This is where the word tree catches up.
    updateTag("words");
    return { page };
}

export async function deletePiece(id: string, page: number): Promise<void> {
    await requireAdmin();
    await connect();

    await Piece.deleteOne({ _id: id });

    updateTag("pieces");
    updateTag(`piece-${page}`);
}

/** Returns the slug to navigate to. */
export async function savePerson(input: PersonInput): Promise<{ slug: string }> {
    await requireAdmin();
    await connect();

    const doc = {
        name: input.name,
        bio: input.bio,
        birth: input.birth,
        death: input.death,
        relation: (input.relation ?? [])
            .filter((entry) => entry.relatedPerson)
            .map((entry) => ({
                relatedPerson: objectId(entry.relatedPerson),
                relatedReason: entry.relatedReason,
            })),
    };

    let slug: string;

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
        slug = updated.slug ?? "";
    } else {
        const created = await new Person(doc).save();
        slug = created.slug ?? "";
    }

    updateTag("persons");
    updateTag(`person-${slug}`);
    // Piece reads populate `persons`, and the card prints the name, slug and
    // birth year — so without this a renamed person kept their old name on
    // every cached card indefinitely. The reverse pairing was already handled.
    updateTag("pieces");
    return { slug };
}

export async function deletePerson(id: string, slug: string): Promise<void> {
    await requireAdmin();
    await connect();

    await Person.deleteOne({ _id: id });

    updateTag("persons");
    updateTag(`person-${slug}`);
    // As in savePerson: a deleted person otherwise goes on being listed, and
    // linked to, by every cached piece card that named them.
    updateTag("pieces");
}
