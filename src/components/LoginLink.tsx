import Link from "next/link";

/**
 * The small square in the top-right corner. Grey when logged out, green when
 * logged in — the only indication of session state in the whole interface.
 */
export function LoginLink({ loggedIn = false }: { loggedIn?: boolean }) {
    return <Link href="/login" className={`login-link ${loggedIn ? "login-link--in" : ""}`} aria-label="Log in" />;
}
