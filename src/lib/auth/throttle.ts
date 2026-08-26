/**
 * Rate limit for the login form.
 *
 * Deliberately without the `server-only` guard that session.ts carries: this
 * module holds no secret, only counters, and keeping it importable outside the
 * Next runtime is what lets the limiting rules be tested directly. Its one
 * caller is a "use server" action.
 *
 * There is one credential and no second factor, so every guess is a shot at
 * total control — and `verifyPassword` runs scrypt at Node's defaults, about
 * 16 MB and 100 ms per call, on a function that also serves every page. So the
 * unthrottled form was two problems at once: unlimited guessing, and a way to
 * exhaust memory and CPU with no valid password at all.
 *
 * In-memory and therefore per-instance, which is the honest bound of what this
 * app can do without a shared store. It is not a defence against a distributed
 * attacker; it is a hard ceiling on how fast any one instance will burn scrypt.
 * A platform firewall rule is the layer above it.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
/** Never let one instance run more than this many derivations at once. */
const MAX_CONCURRENT = 4;

interface Bucket {
    count: number;
    resetAt: number;
}

const globalForThrottle = globalThis as unknown as {
    _deciduousLoginThrottle?: { buckets: Map<string, Bucket>; inFlight: number };
};

const state =
    globalForThrottle._deciduousLoginThrottle ??
    (globalForThrottle._deciduousLoginThrottle = { buckets: new Map(), inFlight: 0 });

function sweep(now: number) {
    // The map is keyed by caller, so it has to be bounded by something.
    for (const [key, bucket] of state.buckets) {
        if (bucket.resetAt <= now) state.buckets.delete(key);
    }
}

export type ThrottleVerdict = "ok" | "too-many" | "busy";

/** Claim one attempt for `key`, or say why it cannot be granted. */
export function claimAttempt(key: string): ThrottleVerdict {
    const now = Date.now();
    sweep(now);

    if (state.inFlight >= MAX_CONCURRENT) return "busy";

    const bucket = state.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        state.buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return "ok";
    }

    if (bucket.count >= MAX_ATTEMPTS) return "too-many";

    bucket.count += 1;
    return "ok";
}

/** Run `work` while counting it against the concurrency ceiling. */
export async function withAttemptSlot<T>(work: () => Promise<T>): Promise<T> {
    state.inFlight += 1;
    try {
        return await work();
    } finally {
        state.inFlight -= 1;
    }
}

/** A successful login clears the caller's budget. */
export function clearAttempts(key: string) {
    state.buckets.delete(key);
}
