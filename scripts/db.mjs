#!/usr/bin/env node
//
// The local MongoDB the test suite talks to.
//
// tests/helpers.mts skips the database and editor suites — loudly — when
// nothing is listening on 27017, which keeps `npm test` useful on a machine
// with no server. That is the right default and the wrong thing to leave
// permanently true: the write tests are the ones covering the code most able
// to lose an author's work, so bringing a server up has to be one command.
//
//   node scripts/db.mjs up       # start it, seeding from dump/ if it is empty
//   node scripts/db.mjs down     # stop it, keeping the data
//   node scripts/db.mjs status   # what is running, and what is in it
//   node scripts/db.mjs reset    # drop the database and seed it again
//
// The container is named, so `up` is idempotent in all three of its states:
// absent, stopped, already running. Data lives in the container's own volume
// and survives `down`; `docker rm deciduous-mongo` is what forgets it.
//
import { execFileSync, spawnSync } from "node:child_process";
import { MongoClient } from "mongodb";

const IMAGE = "mongo:8";

// Matches the default in tests/helpers.mts. Kept local on purpose: these
// tests write, and the helper refuses anything that is not localhost.
const URI = process.env.TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017/deciduous";

// The port is read from the URI rather than set beside it, so the container
// cannot end up published somewhere the tests are not looking.
const parsed = new URL(URI.replace(/^mongodb:/, "http:"));
const PORT = parsed.port || "27017";
const DB = parsed.pathname.slice(1) || "deciduous";
const CONTAINER = process.env.DB_CONTAINER ?? "deciduous-mongo";

const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();

/** "running", "stopped", or "absent". */
function containerState() {
    try {
        // stderr is swallowed: asking after a container that was never created
        // is a question this script answers, not an error to print.
        const status = execFileSync("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        return status === "true" ? "running" : "stopped";
    } catch {
        return "absent";
    }
}

function requireDocker() {
    try {
        docker("info", "--format", "{{.ServerVersion}}");
    } catch {
        console.error("Docker is not running. Start Docker Desktop and try again.");
        process.exit(1);
    }
}

/** Wait for the server to accept a connection, rather than guessing at a sleep. */
async function waitForMongo(timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const client = new MongoClient(URI, { serverSelectionTimeoutMS: 1000 });
        try {
            await client.connect();
            await client.db(DB).command({ ping: 1 });
            await client.close();
            return true;
        } catch {
            await client.close().catch(() => {});
            if (Date.now() > deadline) return false;
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
}

async function counts() {
    const client = new MongoClient(URI, { serverSelectionTimeoutMS: 2000 });
    try {
        await client.connect();
        const db = client.db(DB);
        const collections = await db.listCollections().toArray();
        const rows = {};
        for (const collection of collections) {
            rows[collection.name] = await db.collection(collection.name).countDocuments();
        }
        return rows;
    } finally {
        await client.close().catch(() => {});
    }
}

/** Restore dump/ through the script that already knows how to read it. */
function seed(extra = []) {
    const result = spawnSync(process.execPath, ["scripts/seed-local.mjs", ...extra], {
        stdio: "inherit",
        env: { ...process.env, MONGODB_URI: URI },
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
}

async function up() {
    requireDocker();
    const state = containerState();

    if (state === "absent") {
        console.log(`Creating ${CONTAINER} from ${IMAGE}…`);
        // mongod listens on 27017 inside the container whatever the URI says,
        // so only the host side of the mapping moves.
        docker("run", "-d", "--name", CONTAINER, "-p", `${PORT}:27017`, IMAGE);
    } else if (state === "stopped") {
        console.log(`Starting ${CONTAINER}…`);
        docker("start", CONTAINER);
    } else {
        console.log(`${CONTAINER} is already running.`);
    }

    if (!(await waitForMongo())) {
        console.error(`${CONTAINER} did not accept a connection. Try: docker logs ${CONTAINER}`);
        process.exit(1);
    }

    const rows = await counts();
    if (Object.keys(rows).length === 0) {
        console.log("Empty database — seeding from dump/.");
        seed();
    }

    await status();
}

async function down() {
    requireDocker();
    if (containerState() === "absent") {
        console.log(`No ${CONTAINER} to stop.`);
        return;
    }
    docker("stop", CONTAINER);
    console.log(`${CONTAINER} stopped. Data is kept; \`docker rm ${CONTAINER}\` forgets it.`);
}

async function status() {
    const state = containerState();
    console.log(`${CONTAINER}: ${state}`);
    if (state !== "running") {
        console.log("Run `npm run db:up` to start it.");
        return;
    }
    console.log(`uri: ${URI}`);
    try {
        const rows = await counts();
        const names = Object.keys(rows);
        if (names.length === 0) console.log("(empty database)");
        for (const name of names) console.log(`  ${name}: ${rows[name]}`);
    } catch (error) {
        console.log(`could not read it: ${error.message}`);
    }
}

async function reset() {
    requireDocker();
    if (containerState() !== "running") await up();
    console.log("Dropping and re-seeding…");
    seed(["--drop"]);
    await status();
}

const command = process.argv[2] ?? "status";
const commands = { up, down, status, reset };

if (!commands[command]) {
    console.error(`Unknown command "${command}". Use: up | down | status | reset`);
    process.exit(1);
}

await commands[command]();
