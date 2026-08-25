#!/usr/bin/env node
//
// Restore dump/deciduous into a local MongoDB, without needing mongorestore.
//
// A .bson dump file is just concatenated BSON documents, each prefixed with a
// 4-byte little-endian length covering the whole document, so the `bson`
// package that ships with the driver is enough to read them. That keeps local
// setup to "a mongod on a port" rather than a full mongo-tools install.
//
//   node scripts/seed-local.mjs --inspect     # report shapes, no server needed
//   node scripts/seed-local.mjs               # restore into $MONGODB_URI
//   node scripts/seed-local.mjs --drop        # drop collections first
//
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { deserialize } from "bson";
import { MongoClient } from "mongodb";

const args = process.argv.slice(2);
const hasFlag = (n) => args.includes(`--${n}`);
const argOf = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i > -1 && args[i + 1] ? args[i + 1] : d;
};

const DUMP = path.resolve(argOf("dump", "dump/deciduous"));
const URI = process.env.MONGODB_URI || argOf("uri", "mongodb://127.0.0.1:27017");
const DB = argOf("db", "deciduous");

function readBson(file) {
    const buf = readFileSync(file);
    const docs = [];
    let off = 0;
    while (off < buf.length) {
        const len = buf.readInt32LE(off);
        if (len <= 0 || off + len > buf.length) break;
        docs.push(deserialize(buf.subarray(off, off + len)));
        off += len;
    }
    return docs;
}

if (!existsSync(DUMP)) {
    console.error(`\n  No dump at ${DUMP}\n`);
    process.exit(1);
}

const files = readdirSync(DUMP)
    .filter((f) => f.endsWith(".bson"))
    .sort();

const collections = files.map((f) => ({
    name: path.basename(f, ".bson"),
    docs: readBson(path.join(DUMP, f)),
}));

console.log(`\n  dump: ${DUMP}\n`);
for (const c of collections) {
    console.log(`    ${c.name.padEnd(20)} ${String(c.docs.length).padStart(5)} docs`);
}

if (hasFlag("inspect")) {
    const pieces = collections.find((c) => c.name === "pieces");
    if (pieces?.docs.length) {
        const pages = pieces.docs.map((p) => p.page).filter((p) => p != null);
        console.log(
            `\n    pieces pages ${Math.min(...pages)}–${Math.max(...pages)} (${pages.length} numbered)`
        );
        console.log(`    piece fields: ${Object.keys(pieces.docs[0]).join(", ")}`);
    }
    const counters = collections.find((c) => c.name === "identitycounters");
    if (counters) console.log(`\n    counters: ${JSON.stringify(counters.docs)}`);
    console.log("");
    process.exit(0);
}

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
try {
    await client.connect();
} catch (err) {
    console.error(`\n  Could not reach MongoDB at ${URI}`);
    console.error(`  ${err.message}`);
    console.error(`\n  Start one, e.g.:`);
    console.error(`    docker run -d --name deciduous-mongo -p 27017:27017 mongo:8\n`);
    process.exit(1);
}

const db = client.db(DB);
console.log(`\n  restoring into ${DB} at ${URI}\n`);

for (const c of collections) {
    if (hasFlag("drop")) {
        await db.collection(c.name).drop().catch(() => {});
    }
    if (c.docs.length) {
        await db.collection(c.name).insertMany(c.docs, { ordered: false });
    }
    const count = await db.collection(c.name).countDocuments();
    console.log(`    ${c.name.padEnd(20)} ${String(count).padStart(5)} docs in db`);
}

// The text index the legacy Piece schema declares. Search fails without it,
// and index creation is not carried in a bson dump's data files.
await db.collection("pieces").createIndex(
    { content: "text", title: "text", readme: "text" },
    { name: "content_text_title_text_readme_text" }
);
// Matches the unique index mongoose-auto-increment-fix creates.
await db.collection("identitycounters").createIndex(
    { field: 1, model: 1 },
    { unique: true, background: true }
);
console.log(`\n    indexes created`);

await client.close();
console.log("");
