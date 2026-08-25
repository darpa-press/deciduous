"use server";

import { redirect } from "next/navigation";

import { startSession, endSession, verifyPassword } from "@/lib/auth/session";

/**
 * The codex has one author, so there is no username — only a password.
 * A failed attempt returns a message rather than throwing, so the form can
 * show it plainly.
 */
export async function logIn(_prev: string | null, formData: FormData): Promise<string | null> {
    const password = String(formData.get("password") ?? "");
    if (!password) return "Enter a password.";

    if (!(await verifyPassword(password))) {
        return "That password is not right.";
    }

    await startSession();
    redirect("/");
}

export async function logOut() {
    await endSession();
    redirect("/");
}
