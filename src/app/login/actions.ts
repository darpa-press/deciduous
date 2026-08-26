"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { startSession, endSession, verifyPassword } from "@/lib/auth/session";
import { claimAttempt, clearAttempts, withAttemptSlot } from "@/lib/auth/throttle";

/**
 * The codex has one author, so there is no username — only a password.
 * A failed attempt returns a message rather than throwing, so the form can
 * show it plainly.
 *
 * Attempts are rate limited before any hashing happens — see lib/auth/throttle
 * for why the cost of the hash is itself part of the problem.
 */

/** Who is asking, as well as this can be known behind a proxy. */
async function caller(): Promise<string> {
    const store = await headers();
    const forwarded = store.get("x-forwarded-for");
    return forwarded?.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
}

export async function logIn(_prev: string | null, formData: FormData): Promise<string | null> {
    const password = String(formData.get("password") ?? "");
    if (!password) return "Enter a password.";

    const key = await caller();
    const verdict = claimAttempt(key);
    if (verdict === "too-many") {
        return "Too many attempts. Wait a few minutes and try again.";
    }
    if (verdict === "busy") {
        return "Too many attempts at once. Try again in a moment.";
    }

    const ok = await withAttemptSlot(() => verifyPassword(password));
    if (!ok) {
        return "That password is not right.";
    }

    clearAttempts(key);
    await startSession();
    redirect("/");
}

export async function logOut() {
    await endSession();
    redirect("/");
}
