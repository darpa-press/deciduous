"use client";

import Link from "next/link";
import { useActionState } from "react";

import { logIn } from "./actions";

/**
 * Log in. Ported from Routes/Login — same shape, minus the username field,
 * which the single-admin scheme has no use for.
 */
export function LoginForm() {
    const [error, formAction, pending] = useActionState(logIn, null);

    return (
        <div className="login-container">
            <Link href="/" className="login-back">
                &lsaquo; Go back
            </Link>
            <form action={formAction} className="login-form">
                <input
                    className="login-input"
                    type="password"
                    name="password"
                    placeholder="password"
                    autoFocus
                    autoComplete="current-password"
                />
                <button type="submit" className="login-submit" disabled={pending}>
                    {pending ? "…" : "Log in"}
                </button>
                {error && <div className="login-error">{error}</div>}
            </form>
        </div>
    );
}
