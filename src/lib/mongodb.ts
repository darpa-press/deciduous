import mongoose from "mongoose";

/**
 * Connection singleton.
 *
 * The legacy backend opened a connection per request and called
 * `connection.close()` after responding, in every controller. That is the bug
 * to not carry over: under Fluid Compute an instance is reused across many
 * requests, so tearing the connection down after each one is actively harmful.
 * Here the connection is created once per process and never closed.
 *
 * The cache hangs off `globalThis` so it survives module re-evaluation during
 * dev hot reload, which otherwise leaks a new connection on every edit.
 */

const globalForMongoose = globalThis as unknown as {
    _deciduousMongoose?: {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
    };
};

const cache =
    globalForMongoose._deciduousMongoose ??
    (globalForMongoose._deciduousMongoose = { conn: null, promise: null });

export async function connect(): Promise<typeof mongoose> {
    if (cache.conn) return cache.conn;

    // Read the URI lazily rather than at module scope: Next evaluates modules
    // at build time, and a missing env var should not fail the build.
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error(
            "MONGODB_URI is not set. Copy .env.example to .env.local and point it at your local MongoDB."
        );
    }

    if (!cache.promise) {
        cache.promise = mongoose.connect(uri).catch((err) => {
            // Clear the failed promise so the next request retries rather than
            // resolving the same rejection forever.
            cache.promise = null;
            throw err;
        });
    }

    cache.conn = await cache.promise;
    return cache.conn;
}
