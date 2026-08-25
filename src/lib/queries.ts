import { connect } from "@/lib/mongodb";
import { Piece } from "@/models/Piece";
import { Person } from "@/models/Person";
import { Word } from "@/models/Word";

/**
 * Read queries, one per thing a pane needs.
 *
 * These are the successors to the legacy controllers, minus the HTTP layer.
 * Each is verified against the Phase 0 golden snapshots by
 * scripts/verify-data-layer.mts, so the shapes here match what the 2020 API
 * served — including quirks like `themes` passing through.
 */

export async function getPieceByPage(page: number) {
    await connect();
    return Piece.findOne({ page })
        .populate("persons")
        .populate("parent")
        .populate({ path: "word", model: "Word" })
        .lean();
}

export async function getPieceCount() {
    await connect();
    return Piece.countDocuments();
}

export async function getPersonBySlug(slug: string) {
    await connect();
    const person = await Person.findOne({ slug }).lean();
    if (!person) return null;
    const pieces = await Piece.find({ persons: person._id }).lean();
    return { ...person, pieces };
}

export async function getWordById(id: string) {
    await connect();
    const word = await Word.findOne({ _id: id }).lean();
    if (!word) return null;
    const pieces = await Piece.find({ word: id })
        .populate("persons")
        .populate("parent")
        .populate({ path: "word", model: "Word" })
        .lean();
    return { word, pieces };
}

export async function getChildPieces(parentId: string) {
    await connect();
    return Piece.find({ parent: parentId }).lean();
}
