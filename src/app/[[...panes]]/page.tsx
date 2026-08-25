import { headers } from "next/headers";

import "@/styles/content.css";
import { PaneHost } from "@/components/panes/PaneHost";
import { PaneBody } from "@/components/panes/PaneBody";
import { paneMetadata } from "@/lib/pane-metadata";
import { PANE_HEADER } from "@/proxy";
import { isLoggedIn } from "@/lib/auth/session";

/**
 * Every URL in the codex is a stack of panes: `/2/125` is piece 2 beside piece
 * 125, `/index/p-someone` is the index beside a person.
 *
 * The page server-renders the initial stack, then each PaneHost takes over its
 * own position. Links move the URL with history.pushState instead of
 * navigating, so this route renders once per real page load and panes update
 * independently — see app/pane-action.tsx.
 *
 * The stack never changes length: a link always overwrites a position, never
 * appends, so the number of panes is fixed for the life of the page.
 */

/**
 * `/index` is the tree index, but Next normalises that exact path to `/`
 * before routing, so it arrives with no segments. The proxy marks it with a
 * header — see src/proxy.ts.
 */
async function resolveSegments(panes: string[] | undefined): Promise<string[]> {
    if (panes?.length) return panes;
    const marked = (await headers()).get(PANE_HEADER);
    return marked ? [marked] : [];
}

/**
 * The route blocks rather than partially prerendering.
 *
 * With Cache Components, `params` must be read inside a Suspense boundary, and
 * anything rendered inside that streamed hole never hydrates — the markup
 * arrives but no client component in it ever mounts, so every link falls back
 * to a full page load. Verified with a probe component: mounted outside the
 * boundary, never mounted inside it.
 *
 * Blocking costs nothing here. Every pane is data-driven, so partial
 * prerendering only ever produced an empty shell.
 */
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[[...panes]]">) {
    const { panes } = await params;
    return paneMetadata(await resolveSegments(panes));
}

async function Stack({ params }: { params: PageProps<"/[[...panes]]">["params"] }) {
    const { panes } = await params;
    const segments = await resolveSegments(panes);
    const loggedIn = await isLoggedIn();

    return (
        <>
            {segments.map((segment, index) => (
                <PaneHost key={index} index={index} initialSegment={segment} loggedIn={loggedIn}>
                    {/* No Suspense boundary. The route blocks, so a boundary
                        here would only turn the pane into a streamed hole —
                        and client components inside one never hydrate, which
                        left slow panes such as the index stuck on a fallback
                        forever. */}
                    <PaneBody segment={segment} index={index} loggedIn={loggedIn} />
                </PaneHost>
            ))}
        </>
    );
}

export default function PanesPage({ params }: PageProps<"/[[...panes]]">) {
    return (
        <div className="pane-container">
            <Stack params={params} />
        </div>
    );
}
