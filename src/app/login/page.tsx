import type { Metadata } from "next";
import Link from "next/link";

import { isLoggedIn } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";
import { logOut } from "./actions";
import "@/styles/content.css";

export const metadata: Metadata = { title: "Log in — Deciduous" };

/** Blocking: the session is read from cookies, which cannot be prerendered. */
export const instant = false;

export default async function LoginPage() {
    if (await isLoggedIn()) {
        return (
            <div className="login-container">
                <form action={logOut} className="login-form">
                    <Link href="/" className="login-back">
                        &lsaquo; Go back
                    </Link>
                    <div style={{ paddingBottom: "1rem" }}>Already logged in.</div>
                    <button type="submit" className="login-submit">
                        Log out
                    </button>
                </form>
            </div>
        );
    }

    return <LoginForm />;
}
