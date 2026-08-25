import { isLoggedIn } from "@/lib/auth/session";
import { LoginLink } from "@/components/LoginLink";

/**
 * The login square, resolved from the session.
 *
 * Isolated in its own component so the cookie read stays inside a Suspense
 * boundary. Reading cookies directly in the root layout would make every route
 * in the app dynamic, including the not-found page.
 */
export async function SessionDot() {
    return <LoginLink loggedIn={await isLoggedIn()} />;
}
