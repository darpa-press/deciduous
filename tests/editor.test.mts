import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { databaseAvailable, assertLocalDatabase } from "./helpers.mts";

/**
 * The editing actions, over a database.
 *
 * These are the writes — the code most able to lose an author's work — so they
 * are exercised against real documents rather than a stub. The framework skin
 * in app/editor-actions.ts cannot be imported here (`next/headers` needs a
 * request scope, `updateTag` throws outside a Server Action); lib/edit.ts is
 * that module with the admin check and the cache tags lifted off, and it is
 * what the actions call.
 *
 * As in data.test.mts: localhost only, everything created is torn down in
 * `after`, and creating a piece burns a page number that deleting it does not
 * reclaim — which is correct, a page number is a permalink.
 */

assertLocalDatabase();

const created: { model: "Piece" | "Person"; id: unknown }[] = [];

// Probed at module scope: node:test decides whether to skip a test when it is
// registered, which is before any hook has run.
const available = await databaseAvailable();

const models = available
    ? {
          Piece: (await import("../src/models/Piece")).Piece,
          Person: (await import("../src/models/Person")).Person,
      }
    : null;

const edit = available ? await import("../src/lib/edit") : null!;
const Piece = models?.Piece as NonNullable<typeof models>["Piece"];
const Person = models?.Person as NonNullable<typeof models>["Person"];

after(async () => {
    if (!available) return;
    for (const row of created) {
        if (row.model === "Piece") await Piece.deleteOne({ _id: row.id });
        if (row.model === "Person") await Person.deleteOne({ _id: row.id });
    }
    await mongoose.disconnect();
});

const skip = () => (available ? false : "no local MongoDB — start one to run these");

/** A complete PieceInput, so each test states only what it is about. */
function pieceInput(over: Partial<import("../src/lib/edit").PieceInput> = {}) {
    return {
        title: `test piece ${Math.random().toString(36).slice(2, 10)}`,
        content: "",
        readme: "",
        background: "",
        stub: false,
        fullWidth: false,
        parent: null,
        lovers: [],
        persons: [],
        word: [],
        ...over,
    };
}

/** Save a new piece and register it for teardown. Returns the stored document. */
async function makePiece(over: Partial<import("../src/lib/edit").PieceInput> = {}) {
    const { page } = await edit.savePiece(pieceInput(over));
    const doc = await Piece.findOne({ page }).lean();
    assert.ok(doc, "the piece just saved should be readable");
    created.push({ model: "Piece", id: doc._id });
    return doc;
}

async function makePerson(over: Partial<import("../src/lib/edit").PersonInput> = {}) {
    const { slug } = await edit.savePerson({
        name: `Test Person ${Math.random().toString(36).slice(2, 10)}`,
        bio: "",
        birth: null,
        death: null,
        relation: [],
        ...over,
    });
    const doc = await Person.findOne({ slug }).lean();
    assert.ok(doc, "the person just saved should be readable");
    created.push({ model: "Person", id: doc._id });
    return doc;
}

describe("savePiece: a new piece", () => {
    test("gets a page number and a slug from its title", { skip: skip() }, async () => {
        const doc = await makePiece({ title: "A Test Of The Editor" });

        assert.equal(typeof doc.page, "number");
        assert.equal(doc.slug, "a-test-of-the-editor");
        assert.equal(doc.__v, 0, "a new document starts at version 0");
    });

    test("keeps only the ids that are real ids", { skip: skip() }, async () => {
        // The form sends whatever is in the select; a stale or hand-edited
        // option used to reach mongoose as a cast error and fail the whole save.
        const person = await makePerson();
        const doc = await makePiece({
            persons: [String(person._id), "not-an-id", ""],
            lovers: ["also-not-an-id"],
        });

        assert.deepEqual(doc.persons.map(String), [String(person._id)]);
        assert.deepEqual(doc.lovers, []);
    });
});

describe("savePiece: the version match", () => {
    test("an edit at the loaded version saves and bumps the version", { skip: skip() }, async () => {
        const doc = await makePiece();

        const { page } = await edit.savePiece(
            pieceInput({ id: String(doc._id), version: doc.__v, title: "Edited once" })
        );

        const after = await Piece.findById(doc._id).lean();
        assert.equal(page, doc.page, "an edit does not move the permalink");
        assert.equal(after?.title, "Edited once");
        assert.equal(after?.__v, (doc.__v ?? 0) + 1);
    });

    // Regression: the update was a blind $set over a snapshot taken whenever
    // the pane last rendered, so the second of two open tabs silently erased
    // the first with nothing shown to either.
    test("a stale version is refused, not applied", { skip: skip() }, async () => {
        const doc = await makePiece();
        const stale = doc.__v;

        // The first tab saves.
        await edit.savePiece(
            pieceInput({ id: String(doc._id), version: stale, title: "First author" })
        );

        // The second tab, still holding the version it loaded, saves over it.
        await assert.rejects(
            edit.savePiece(
                pieceInput({ id: String(doc._id), version: stale, title: "Second author" })
            ),
            (error: Error) => error.message === edit.STALE
        );

        const after = await Piece.findById(doc._id).lean();
        assert.equal(after?.title, "First author", "the first author's work survived");
    });

    test("a piece that is gone says so, rather than reporting staleness", { skip: skip() }, async () => {
        const doc = await makePiece();
        await edit.deletePiece(String(doc._id));

        await assert.rejects(
            edit.savePiece(pieceInput({ id: String(doc._id), version: doc.__v })),
            (error: Error) => {
                assert.notEqual(error.message, edit.STALE);
                assert.match(error.message, /no longer exists/);
                return true;
            }
        );
    });

    test("no version supplied still saves, as a form without one must", { skip: skip() }, async () => {
        const doc = await makePiece();

        await edit.savePiece(
            pieceInput({ id: String(doc._id), version: null, title: "Unversioned save" })
        );

        const after = await Piece.findById(doc._id).lean();
        assert.equal(after?.title, "Unversioned save");
    });
});

describe("savePiece: the cycle walk", () => {
    test("a piece cannot be filed under itself", { skip: skip() }, async () => {
        const doc = await makePiece();

        await edit.savePiece(
            pieceInput({ id: String(doc._id), version: doc.__v, parent: String(doc._id) })
        );

        const after = await Piece.findById(doc._id).lean();
        assert.equal(after?.parent ?? null, null, "the parent was refused, not stored");
    });

    // The loop the editor's own option list cannot see: filing a grandparent
    // under its own grandchild. Every piece in the loop drops out of the index
    // tree, silently.
    test("a longer loop is refused", { skip: skip() }, async () => {
        const top = await makePiece();
        const middle = await makePiece({ parent: String(top._id) });
        const bottom = await makePiece({ parent: String(middle._id) });

        await edit.savePiece(
            pieceInput({ id: String(top._id), version: top.__v, parent: String(bottom._id) })
        );

        const after = await Piece.findById(top._id).lean();
        assert.equal(after?.parent ?? null, null);
    });

    test("a legitimate ancestor is kept", { skip: skip() }, async () => {
        const top = await makePiece();
        const middle = await makePiece({ parent: String(top._id) });
        const leaf = await makePiece();

        await edit.savePiece(
            pieceInput({ id: String(leaf._id), version: leaf.__v, parent: String(middle._id) })
        );

        const after = await Piece.findById(leaf._id).lean();
        assert.equal(String(after?.parent), String(middle._id));
    });

    test("wouldCycle answers without a parent to check", { skip: skip() }, async () => {
        const doc = await makePiece();
        assert.equal(await edit.wouldCycle(String(doc._id), null), false);
        assert.equal(await edit.wouldCycle(null, doc._id), false);
    });

    // The walk is bounded by a hop count as well as by its answer, so a loop
    // already in the data cannot spin here. Written straight to the collection,
    // since savePiece is what stops it being created through the editor.
    test("a loop already in the data terminates rather than hanging", { skip: skip() }, async () => {
        const a = await makePiece();
        const b = await makePiece();
        await Piece.updateOne({ _id: a._id }, { parent: b._id });
        await Piece.updateOne({ _id: b._id }, { parent: a._id });

        const outsider = await makePiece();
        // Walking up from `a` never reaches `outsider` and never ends; the hop
        // bound has to stop it, and it fails closed.
        assert.equal(await edit.wouldCycle(String(outsider._id), a._id), true);
    });
});

describe("createPerson", () => {
    test("creates someone who is not there yet", { skip: skip() }, async () => {
        const name = `Ada ${Math.random().toString(36).slice(2, 10)}`;
        const result = await edit.createPerson({ name, birth: 1815, death: 1852 });
        created.push({ model: "Person", id: result.id });

        assert.equal(result.created, true);
        assert.equal(result.name, name);

        const doc = await Person.findById(result.id).lean();
        assert.equal(doc?.birth, 1815);
        assert.ok(doc?.slug, "a person created here still gets a slug");
    });

    // Two people may legitimately share a name, but from this form the name is
    // nearly all we have — a second record differing only in case is
    // indistinguishable from the first in the option list.
    test("reuses a name that differs only in case", { skip: skip() }, async () => {
        const name = `Grace ${Math.random().toString(36).slice(2, 10)}`;
        const first = await edit.createPerson({ name, birth: 1906, death: null });
        created.push({ model: "Person", id: first.id });

        const again = await edit.createPerson({
            name: name.toUpperCase(),
            birth: 1900,
            death: null,
        });

        assert.equal(again.created, false);
        assert.equal(again.id, first.id);
        assert.equal(again.name, name, "the stored casing is what comes back");

        const doc = await Person.findById(first.id).lean();
        assert.equal(doc?.birth, 1906, "this form is not where dates get revised");
    });

    test("trims before deciding, so spacing does not make a duplicate", { skip: skip() }, async () => {
        const name = `Alan ${Math.random().toString(36).slice(2, 10)}`;
        const first = await edit.createPerson({ name, birth: null, death: null });
        created.push({ model: "Person", id: first.id });

        const again = await edit.createPerson({ name: `  ${name}  `, birth: null, death: null });
        assert.equal(again.created, false);
        assert.equal(again.id, first.id);
    });

    // The name goes into a RegExp to match case-insensitively. Unescaped, a
    // name containing metacharacters either matched the wrong person or threw.
    test("a name full of metacharacters is matched literally", { skip: skip() }, async () => {
        const tag = Math.random().toString(36).slice(2, 10);
        const name = `A.C.(x)+[y]* ${tag}`;
        const first = await edit.createPerson({ name, birth: null, death: null });
        created.push({ model: "Person", id: first.id });

        const again = await edit.createPerson({ name, birth: null, death: null });
        assert.equal(again.created, false, "the same name found the same person");

        // The pattern that name would compile to, if it were not escaped.
        const other = await edit.createPerson({ name: `AxCxxy ${tag}`, birth: null, death: null });
        created.push({ model: "Person", id: other.id });
        assert.equal(other.created, true, "a name it would only match as a pattern is a new person");
    });

    test("refuses a blank name", { skip: skip() }, async () => {
        await assert.rejects(
            edit.createPerson({ name: "   ", birth: null, death: null }),
            /needs a name/
        );
    });
});

describe("savePerson", () => {
    test("a stale version is refused, not applied", { skip: skip() }, async () => {
        const doc = await makePerson();
        const stale = doc.__v;

        await edit.savePerson({
            id: String(doc._id),
            version: stale,
            name: "First author",
            bio: "",
            birth: null,
            death: null,
            relation: [],
        });

        await assert.rejects(
            edit.savePerson({
                id: String(doc._id),
                version: stale,
                name: "Second author",
                bio: "",
                birth: null,
                death: null,
                relation: [],
            }),
            (error: Error) => error.message === edit.STALE
        );

        const after = await Person.findById(doc._id).lean();
        assert.equal(after?.name, "First author");
    });

    test("an edit does not move the slug", { skip: skip() }, async () => {
        // findOneAndUpdate skips the pre-save hooks, so a rename keeps the
        // original slug — which is the permalink people already have.
        const doc = await makePerson({ name: "Slug Stays Put" });

        await edit.savePerson({
            id: String(doc._id),
            version: doc.__v,
            name: "Renamed Entirely",
            bio: "",
            birth: null,
            death: null,
            relation: [],
        });

        const after = await Person.findById(doc._id).lean();
        assert.equal(after?.slug, doc.slug);
        assert.equal(after?.name, "Renamed Entirely");
    });

    test("relation rows with nobody in them are dropped", { skip: skip() }, async () => {
        const other = await makePerson();
        const doc = await makePerson({
            relation: [
                { relatedPerson: String(other._id), relatedReason: "correspondent" },
                { relatedPerson: "", relatedReason: "an empty row from the form" },
            ],
        });

        assert.equal(doc.relation.length, 1);
        assert.equal(String(doc.relation[0].relatedPerson), String(other._id));
        assert.equal(doc.relation[0].relatedReason, "correspondent");
    });
});

describe("deleting", () => {
    test("a piece is gone", { skip: skip() }, async () => {
        const doc = await makePiece();
        await edit.deletePiece(String(doc._id));
        assert.equal(await Piece.findById(doc._id).lean(), null);
    });

    test("a person is gone", { skip: skip() }, async () => {
        const doc = await makePerson();
        await edit.deletePerson(String(doc._id));
        assert.equal(await Person.findById(doc._id).lean(), null);
    });

    // Pinning what happens today, which is nothing: a delete does not visit the
    // pieces that referenced the row. The piece pane tolerates it — populate
    // drops the missing id — but the reference is still stored, and if that is
    // ever meant to be cleaned up, this test is where the decision shows up.
    test("leaves references to the deleted person behind", { skip: skip() }, async () => {
        const person = await makePerson();
        const piece = await makePiece({ persons: [String(person._id)] });

        await edit.deletePerson(String(person._id));

        const after = await Piece.findById(piece._id).lean();
        assert.deepEqual(after?.persons.map(String), [String(person._id)]);
    });

    // Same, one level up: deleting a parent orphans its children rather than
    // reparenting them, and listToTree makes a dangling parent a root — which
    // is what keeps them reachable in the index.
    test("leaves children pointing at the deleted parent", { skip: skip() }, async () => {
        const parent = await makePiece();
        const child = await makePiece({ parent: String(parent._id) });

        await edit.deletePiece(String(parent._id));

        const after = await Piece.findById(child._id).lean();
        assert.equal(String(after?.parent), String(parent._id));
    });
});
