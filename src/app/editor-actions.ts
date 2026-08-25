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

/** Returns the page number to navigate to. */
export async function savePiece(input: PieceInput): Promise<{ page: number }> {
    await requireAdmin();
    await connect();

    const doc = {
        title: input.title,
        content: input.content,
        readme: input.readme,
        background: input.background,
        stub: Boolean(input.stub),
        fullWidth: Boolean(input.fullWidth),
        parent: objectId(input.parent),
        lovers: objectIds(input.lovers),
        persons: objectIds(input.persons),
        word: input.word ?? [],
    };

    let page: number;

    if (input.id) {
        // findOneAndUpdate, as the legacy controller did — which means the
        // pre-save hooks do not run and the slug is left alone on edit.
        const updated = await Piece.findOneAndUpdate({ _id: input.id }, doc, {
            new: true,
            runValidators: true,
        }).exec();
        if (!updated) throw new Error("That piece no longer exists.");
        page = updated.page ?? 0;
    } else {
        // A new document goes through save(), so it gets its page number from
        // the counter and its slug from the title.
        const created = await new Piece(doc).save();
        page = created.page ?? 0;
    }

    updateTag("pieces");
    updateTag(`piece-${page}`);
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
        const updated = await Person.findOneAndUpdate({ _id: input.id }, doc, {
            new: true,
            runValidators: true,
        }).exec();
        if (!updated) throw new Error("That person no longer exists.");
        slug = updated.slug ?? "";
    } else {
        const created = await new Person(doc).save();
        slug = created.slug ?? "";
    }

    updateTag("persons");
    updateTag(`person-${slug}`);
    return { slug };
}

export async function deletePerson(id: string, slug: string): Promise<void> {
    await requireAdmin();
    await connect();

    await Person.deleteOne({ _id: id });

    updateTag("persons");
    updateTag(`person-${slug}`);
}
