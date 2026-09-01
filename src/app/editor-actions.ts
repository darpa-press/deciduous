"use server";

import { updateTag } from "next/cache";

import * as edit from "@/lib/edit";
import { type Candidate } from "@/lib/wikidata";
import { lookupPerson } from "@/lib/wikidata-lookup";
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
 *
 * The writes themselves are in lib/edit.ts — auth and cache tags are the only
 * things here that need the framework, and keeping them apart is what lets the
 * writes be tested. See the note at the top of that file.
 */

export type PieceInput = edit.PieceInput;
export type PersonInput = edit.PersonInput;
export type PersonDraft = edit.PersonDraft;
export type { Candidate };

/**
 * People on Wikidata matching a name, for the date lookup in both editors.
 *
 * A read, so there is no tag to update — and gated all the same, because an
 * action is reachable by anyone who knows its id and this one spends the
 * codex's rate limit at Wikimedia.
 */
export async function lookupPersonDates(name: string): Promise<Candidate[]> {
    await requireAdmin();
    return lookupPerson(name);
}

/** Returns the page number to navigate to. */
export async function savePiece(input: PieceInput): Promise<{ page: number }> {
    await requireAdmin();

    const { page } = await edit.savePiece(input);

    updateTag("pieces");
    updateTag(`piece-${page}`);
    // The piece's word links are written here, and attachWord deliberately
    // leaves the tag alone — refreshing the route from under an open editor
    // rendered the page twice. This is where the word tree catches up.
    updateTag("words");
    // createPerson leaves the `persons` tag alone for the same reason, so this
    // is where a person made from inside this form reaches the person index.
    updateTag("persons");
    return { page };
}

export async function deletePiece(id: string, page: number): Promise<void> {
    await requireAdmin();

    await edit.deletePiece(id);

    updateTag("pieces");
    updateTag(`piece-${page}`);
}

/** Returns the slug to navigate to. */
export async function savePerson(input: PersonInput): Promise<{ slug: string }> {
    await requireAdmin();

    const { slug } = await edit.savePerson(input);

    updateTag("persons");
    updateTag(`person-${slug}`);
    // Piece reads populate `persons`, and the card prints the name, slug and
    // birth year — so without this a renamed person kept their old name on
    // every cached card indefinitely. The reverse pairing was already handled.
    updateTag("pieces");
    return { slug };
}

/**
 * Create a person from the piece editor.
 *
 * As with attachWord, this deliberately does not call updateTag: refreshing
 * the route would re-render the pane under the open piece form and lose
 * everything typed into it. savePiece updates the `persons` tag instead.
 */
export async function createPerson(
    input: PersonDraft
): Promise<{ id: string; name: string; created: boolean }> {
    await requireAdmin();
    return edit.createPerson(input);
}

export async function deletePerson(id: string, slug: string): Promise<void> {
    await requireAdmin();

    await edit.deletePerson(id);

    updateTag("persons");
    updateTag(`person-${slug}`);
    // As in savePerson: a deleted person otherwise goes on being listed, and
    // linked to, by every cached piece card that named them.
    updateTag("pieces");
}
