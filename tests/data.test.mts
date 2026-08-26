import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { databaseAvailable, assertLocalDatabase } from "./helpers.mts";
import { searchQuery } from "../src/lib/search-term";

/**
 * Database-backed tests.
 *
 * These WRITE — they create pieces and people to prove the slug and counter
 * behaviour — so `assertLocalDatabase` refuses anything but localhost, and
 * everything created here is torn down in `after`. Skipped, not failed, when
 * no local MongoDB is running.
 *
 * One effect does not undo: creating a piece burns a page number, and deleting
 * the piece does not reclaim it, because a page number is a permalink and
 * reusing one would be the bug. So a run leaves the local counter a little
 * higher than it found it. That is correct, and it is another reason these
 * only ever point at localhost.
 */

assertLocalDatabase();

/** Everything this file creates, removed at the end whatever happens. */
const created: { model: "Piece" | "Person" | "Word"; id: unknown }[] = [];

// Probed at module scope, not in `before`: node:test decides whether to skip a
// test when it is registered, which is before any hook has run.
const available = await databaseAvailable();

const models = available
    ? {
          Piece: (await import("../src/models/Piece")).Piece,
          Person: (await import("../src/models/Person")).Person,
          Word: (await import("../src/models/Word")).Word,
      }
    : null;

const data = available ? await import("../src/lib/data") : null!;
const counter = available ? await import("../src/lib/page-counter") : null!;
const uniqueSlug = available ? (await import("../src/lib/unique-slug")).uniqueSlug : null!;
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

async function makePerson(name: string) {
    const person = await new Person({ name }).save();
    created.push({ model: "Person", id: person._id });
    return person;
}

async function makePiece(fields: Record<string, unknown>) {
    const piece = await new Piece(fields).save();
    created.push({ model: "Piece", id: piece._id });
    return piece;
}

describe("uniqueSlug", () => {
    // Regression: the suffix came from how *many* rows matched, which is only
    // the next free number while nothing has been deleted. Person slugs are
    // the routing key with no unique index behind them, so a collision made
    // one of the two people permanently unreachable.
    test("does not reuse a slug after a deletion", { skip: skip() }, async () => {
        const base = `test-slug-${Date.now()}`;

        const first = await makePerson(base);
        assert.equal(first.slug, base);

        const second = await makePerson(base);
        assert.equal(second.slug, `${base}-2`);

        // Delete the first, then add a third: counting matches would hand out
        // `-2` a second time.
        await Person.deleteOne({ _id: first._id });

        const third = await makePerson(base);
        assert.notEqual(third.slug, second.slug, "handed out a slug already in use");
        assert.equal(third.slug, base, "should reclaim the now-free base slug");
    });

    test("an edit does not collide with itself", { skip: skip() }, async () => {
        const base = `test-self-${Date.now()}`;
        const person = await makePerson(base);
        const again = await uniqueSlug(Person, base, person._id);
        assert.equal(again, base);
    });

    test("finds the first free suffix", { skip: skip() }, async () => {
        const base = `test-gap-${Date.now()}`;
        const a = await makePerson(base);
        const b = await makePerson(base);
        const c = await makePerson(base);
        const slugs = [a.slug, b.slug, c.slug];
        assert.equal(new Set(slugs).size, 3, `duplicate slugs: ${slugs}`);
    });
});

describe("page counter", () => {
    test("raiseCounterTo only ever raises", { skip: skip() }, async () => {
        const start = await counter.peekCounter();
        assert.ok(start !== null, "counter should exist in the seeded data");

        await counter.raiseCounterTo(start! - 5);
        assert.equal(await counter.peekCounter(), start, "a lower value moved it");

        await counter.raiseCounterTo(start! + 5);
        assert.equal(await counter.peekCounter(), start! + 5);

        // Put it back so the suite leaves nothing behind.
        await counter.IdentityCounterModel.updateOne(
            { model: "Piece", field: "page" },
            { $set: { count: start } }
        );
        assert.equal(await counter.peekCounter(), start);
    });

    // Regression: raiseCounterTo had no upsert, so importing a piece with an
    // explicit page into a database whose counter row did not exist wrote
    // nothing — and the counter later climbed back through a number in use.
    test("raiseCounterTo seeds a counter that does not exist", { skip: skip() }, async () => {
        const MODEL = `TestModel-${Date.now()}`;
        try {
            await counter.IdentityCounterModel.updateOne(
                { model: MODEL, field: "page" },
                { $max: { count: 42 } },
                { upsert: true }
            );
            const row = await counter.IdentityCounterModel.findOne({ model: MODEL, field: "page" });
            assert.equal(row?.count, 42, "no counter was created");
        } finally {
            await counter.IdentityCounterModel.deleteOne({ model: MODEL, field: "page" });
        }
    });

    test("a new piece never reuses a page number", { skip: skip() }, async () => {
        const before = await counter.peekCounter();
        const piece = await makePiece({ title: `test piece ${Date.now()}` });
        assert.equal(piece.page, before! + 1);
        const clash = await Piece.countDocuments({ page: piece.page });
        assert.equal(clash, 1, "two pieces answer to the same permalink");
    });
});

describe("queries", () => {
    test("getChildPieces answers empty for a non-id", { skip: skip() }, async () => {
        // Regression: an ObjectId path with no validation in front of it threw
        // a CastError, which is a 500 where an empty list is the honest answer.
        for (const bad of ["", "not-an-id", "../../etc", "%%%"]) {
            assert.deepEqual(await data.getChildPieces(bad), [], bad);
        }
    });

    test("getPersonBySlug answers null for an unknown slug", { skip: skip() }, async () => {
        assert.equal(await data.getPersonBySlug(`nobody-${Date.now()}`), null);
    });

    test("getWordById answers null for an unknown id", { skip: skip() }, async () => {
        assert.equal(await data.getWordById(`nosuch-${Date.now()}`), null);
    });

    // Regression: adverbs matched no bucket, so the one in the collection was
    // served fine by URL but nothing in the index could ever link to it.
    test("the word tree reaches every stored word", { skip: skip() }, async () => {
        const tree = await data.getWordTree();
        const seen = new Set<string>();
        const walk = (node: { id?: string; children?: unknown[] }) => {
            if (node.id) seen.add(node.id);
            for (const child of (node.children ?? []) as typeof node[]) walk(child);
        };
        for (const bucket of tree as unknown as { children?: unknown[] }[]) walk(bucket);

        const stored = await models!.Word.find().select("_id").lean();
        const missing = stored.map((w) => String(w._id)).filter((id) => !seen.has(id));
        assert.deepEqual(missing, [], `unreachable from the word index: ${missing.join(", ")}`);
    });

    test("bucket headings carry no id to link to", { skip: skip() }, async () => {
        const tree = (await data.getWordTree()) as unknown as { id?: string; word?: string }[];
        for (const bucket of tree) {
            assert.equal(bucket.id, "", `${bucket.word} would render a link to /w-`);
        }
    });

    // Regression: byte order put every lowercase initial after every uppercase
    // one, and the alphabetical index then stapled such a title onto whichever
    // letter group happened to be open.
    test("people are listed in human order", { skip: skip() }, async () => {
        const persons = (await data.getAllPersons()) as unknown as { name?: string }[];
        const collator = new Intl.Collator("en", { sensitivity: "base" });
        for (let i = 1; i < persons.length; i++) {
            const prev = persons[i - 1].name ?? "";
            const here = persons[i].name ?? "";
            assert.ok(collator.compare(prev, here) <= 0, `${prev} sorted before ${here}`);
        }
    });

    test("pieces are listed in human order by title", { skip: skip() }, async () => {
        const pieces = (await data.getAllPieces({ sort: "title", order: 1 })) as unknown as {
            title?: string;
        }[];
        const collator = new Intl.Collator("en", { sensitivity: "base" });
        for (let i = 1; i < pieces.length; i++) {
            const prev = pieces[i - 1].title ?? "";
            const here = pieces[i].title ?? "";
            assert.ok(collator.compare(prev, here) <= 0, `${prev} sorted before ${here}`);
        }
    });

    test("the index tree reaches every piece", { skip: skip() }, async () => {
        const tree = await data.getPieceTree();
        const seen = new Set<string>();
        const walk = (node: { _id?: unknown; children?: unknown[] }) => {
            if (node._id) seen.add(String(node._id));
            for (const child of (node.children ?? []) as typeof node[]) walk(child);
        };
        for (const root of tree as unknown as { children?: unknown[] }[]) walk(root);

        const all = await Piece.find().select("_id").lean();
        const missing = all.map((p) => String(p._id)).filter((id) => !seen.has(id));
        assert.deepEqual(missing, [], `pieces missing from the index: ${missing.length}`);
    });
});

describe("search", () => {
    test("an unbalanced quote does not widen the match", { skip: skip() }, async () => {
        // Regression: the term was interpolated into a $text phrase, so a
        // quote closed it early and the rest degraded to a loose OR.
        const plain = await data.searchPieces(searchQuery("unicorn")!);
        const quoted = await data.searchPieces(searchQuery('a"b unicorn')!);
        assert.ok(
            quoted.length <= plain.length,
            `a quote widened the match: ${plain.length} -> ${quoted.length}`
        );
    });

    test("a phrase matches fewer pieces than its loosest word", { skip: skip() }, async () => {
        const phrase = await data.searchPieces(searchQuery("green paper")!);
        const loose = await data.searchPieces("green paper");
        assert.ok(phrase.length <= loose.length, "the phrase quoting was lost");
    });
});
