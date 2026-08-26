#!/usr/bin/env node
//
// Copy the live Atlas database into a local MongoDB for development.
//
// Reads only from the source — every source operation here is a find(). The
// target is guarded: the script refuses to write to anything that looks like a
// hosted cluster, so a mistyped URI cannot point the restore at production.
//
//   node scripts/pull-live.mjs                 # prod -> mongodb://127.0.0.1:27017/deciduous
//   node scripts/pull-live.mjs --dry           # counts only, writes nothing
//   node scripts/pull-live.mjs --target mongodb://127.0.0.1:27018
//
// Source URI resolution, first hit wins:
//   SOURCE_MONGODB_URI env var
//   DATABASE in .env.legacy   (the legacy variable name)
//
import { readFileSync, existsSync } from "node:fs";
import { MongoClient } from "mongodb";

const args = process.argv.slice(2);
const hasFlag = (n) => args.includes(`--${n}`);
const argOf = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i > -1 && args[i + 1] ? args[i + 1] : d;
};

function fromEnvFile(file, key) {
    if (!existsSync(file)) return null;
    for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`));
        if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
    return null;
}

const SOURCE = process.env.SOURCE_MONGODB_URI || fromEnvFile(".env.legacy", "DATABASE");
const TARGET = argOf("target", process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");
const TARGET_DB = argOf("db", "deciduous");
const DRY = hasFlag("dry");

if (!SOURCE) {
    console.error(`\n  No source URI. Set SOURCE_MONGODB_URI, or put DATABASE=... in .env.legacy\n`);
    process.exit(1);
}

// Guard: the target must be local. Copying prod onto prod would be
// unrecoverable, so make it impossible rather than careful.
const targetIsLocal = /(^|@|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal)(:|\/|$)/.test(
    TARGET
);
if (!targetIsLocal || /mongodb\+srv:/.test(TARGET)) {
    console.error(`\n  Refusing to write to a non-local target:\n    ${TARGET}\n`);
    console.error(`  This script only restores into localhost.\n`);
    process.exit(1);
}

// Never print credentials.
const redact = (uri) => uri.replace(/\/\/[^@]*@/, "//***:***@");

console.log(`\n  source  ${redact(SOURCE)}`);
console.log(`  target  ${TARGET}/${TARGET_DB}${DRY ? "   (dry run)" : ""}\n`);

const src = new MongoClient(SOURCE, { serverSelectionTimeoutMS: 15000 });
await src.connect();
const srcDb = src.db(); // database from the connection string

const collections = (await srcDb.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .sort();

let dst = null;
let dstDb = null;
if (!DRY) {
    dst = new MongoClient(TARGET, { serverSelectionTimeoutMS: 5000 });
    try {
        await dst.connect();
    } catch (err) {
        console.error(`  Could not reach local MongoDB at ${TARGET}`);
        console.error(`  ${err.message}`);
        console.error(`\n  Start one:\n    docker run -d --name deciduous-mongo -p 27017:27017 mongo:8\n`);
        await src.close();
        process.exit(1);
    }
    dstDb = dst.db(TARGET_DB);
}

// Copied in batches off a cursor. Reading a whole collection into an array
// first is fine at 118 pieces and is not what a restore tool should promise.
const BATCH = 500;

for (const name of collections) {
    if (DRY) {
        const n = await srcDb.collection(name).countDocuments();
        console.log(`    ${name.padEnd(20)} ${String(n).padStart(5)} docs`);
        continue;
    }

    await dstDb.collection(name).drop().catch(() => {});

    const cursor = srcDb.collection(name).find({}).batchSize(BATCH);
    let batch = [];
    for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length >= BATCH) {
            await dstDb.collection(name).insertMany(batch, { ordered: false });
            batch = [];
        }
    }
    if (batch.length) await dstDb.collection(name).insertMany(batch, { ordered: false });

    const n = await dstDb.collection(name).countDocuments();
    console.log(`    ${name.padEnd(20)} ${String(n).padStart(5)} docs copied`);
}

if (!DRY) {
    // Indexes are not carried by a document copy. These two are the ones the
    // application actually depends on: text search, and the counter's
    // uniqueness constraint.
    const idx = await srcDb.collection("pieces").indexes();
    const textIdx = idx.find((i) => Object.values(i.key).includes("text"));
    if (textIdx) {
        await dstDb
            .collection("pieces")
            .createIndex(textIdx.key, { name: textIdx.name, weights: textIdx.weights });
        console.log(`\n    pieces text index recreated (${textIdx.name})`);
    }
    if (collections.includes("identitycounters")) {
        await dstDb
            .collection("identitycounters")
            .createIndex({ field: 1, model: 1 }, { unique: true, background: true });
        console.log(`    identitycounters unique index recreated`);
    }
    await dst.close();
}

await src.close();
console.log("");
