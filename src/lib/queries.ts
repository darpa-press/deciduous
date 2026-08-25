import { connect } from "@/lib/mongodb";
import { Piece } from "@/models/Piece";
import { Person } from "@/models/Person";
import { Word } from "@/models/Word";
import { listToTree } from "@/lib/list-to-tree";

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

// ---------------------------------------------------------------- listings

/**
 * The piece hierarchy, as the index renders it. Ported from getTree in
 * pieceController — including the id/parent string coercion, which is what
 * makes list-to-tree able to match ObjectIds against parent references.
 */
export async function getPieceTree() {
    await connect();
    const pieces = await Piece.find().lean();
    const withParents = pieces.map((piece) => ({
        ...piece,
        id: String(piece._id),
        parent: piece.parent ? String(piece.parent) : "",
    }));
    return listToTree(withParents, { keyId: "id", keyParent: "parent", keyChild: "children" });
}

/** Every piece, sorted. Backs the alphabetical index and the "all" listing. */
export async function getAllPieces({
    sort = "title",
    order = 1,
    limit,
}: { sort?: string; order?: 1 | -1; limit?: number } = {}) {
    await connect();
    const query = Piece.find()
        .sort({ [sort]: order } as Record<string, 1 | -1>)
        .lean();
    if (limit) query.limit(limit);
    const pieces = await query;
    // `hasLink` marks pieces whose content contains an <aa> link. Computed, not
    // stored, and part of the API response the index reads.
    return pieces.map((piece) => ({
        ...piece,
        hasLink: String(piece.content ?? "").toLowerCase().indexOf("<aa") > -1,
    }));
}

export async function getAllPersons() {
    await connect();
    return Person.find().sort({ name: 1 }).lean();
}

/**
 * The word index: every stored synset arranged by hypernym, then split into
 * three buckets.
 *
 * Note that `qualities` matches pos a/v/s and `acts` matches pos v, so every
 * verb appears in both — 490 tree entries for 443 distinct words. That is
 * reproduced rather than corrected; whether it is intentional is a product
 * question, and the golden snapshots assert the current behaviour.
 */
export async function getWordTree() {
    await connect();
    const words = await Word.find().select("word pos gloss parent").lean();
    const withParents = words.map((word) => ({
        ...word,
        id: String(word._id),
        parent: word.parent ? String(word.parent) : "",
    }));

    const tree = listToTree(withParents, {
        keyId: "id",
        keyParent: "parent",
        keyChild: "children",
    });

    const qualities = tree.filter((w) => w.pos === "a" || w.pos === "v" || w.pos === "s");
    const things = tree.filter((w) => w.pos === "n");
    const acts = tree.filter((w) => w.pos === "v");

    return [
        { id: "", word: "qualities", children: qualities },
        { id: "", word: "things", children: things },
        { id: "", word: "acts", children: acts },
    ];
}

/** Full-text search across content, title and readme. */
export async function searchPieces(q: string) {
    await connect();
    if (!q) return [];
    return Piece.find({ $text: { $search: q } })
        .populate("persons")
        .populate("parent")
        .populate({ path: "word", model: "Word" })
        .lean();
}

const graphColors = {
    black: "#555",
    red: "#e41a1c",
    blue: "#377eb8",
};

/**
 * Nodes and edges for the graph view. Ported from getGraph in pieceController.
 *
 * The edge colours carry meaning: black for parentage, blue dashed for a
 * person appearing in a piece, red for a "lover" link between pieces. Persons
 * are emitted before pieces, and the golden snapshot asserts that ordering.
 */
export async function getGraph() {
    await connect();

    const nodes: Record<string, unknown>[] = [];
    const edges: Record<string, unknown>[] = [];

    const persons = await Person.find().lean();
    for (const person of persons) {
        nodes.push({
            id: person._id,
            label: person.name,
            slug: person.slug,
            link: `p-${person.slug}`,
            type: "person",
            color: { background: "white", border: graphColors.blue },
        });
    }

    const pieces = await Piece.find().lean();
    for (const piece of pieces) {
        nodes.push({
            id: piece._id,
            label: piece.title,
            page: piece.page,
            link: piece.page,
            type: "piece",
            color: { background: "white", border: graphColors.black },
        });

        if (piece.parent) {
            edges.push({
                from: piece._id,
                to: piece.parent,
                color: { color: graphColors.black, inherit: false },
            });
        }

        for (const personId of piece.persons ?? []) {
            edges.push({
                from: piece._id,
                to: personId,
                color: { color: graphColors.blue, inherit: false },
                dashes: true,
            });
        }

        for (const loverId of piece.lovers ?? []) {
            edges.push({
                from: piece._id,
                to: loverId,
                color: { color: graphColors.red, inherit: false },
            });
        }
    }

    return { nodes, edges };
}
