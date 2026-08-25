import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import type { Root } from "hast";
import type { ReactNode } from "react";

import { contentSchema } from "./schema";
import { normaliseContent } from "./normalise";
import { AALink } from "@/components/content/AALink";
import { LightImg } from "@/components/content/LightImg";
import { Cartesian } from "@/components/content/Cartesian";
import { getPieceCount } from "@/lib/queries";

/**
 * Renders a piece's stored HTML.
 *
 * Content is HTML-with-custom-elements held in Mongo, exactly as the 2020 app
 * stored it — the migration deliberately does not touch the content format.
 * What changes is the renderer: html-to-react on the client becomes rehype on
 * the server, so most of a piece is now plain server-rendered markup and only
 * the genuinely interactive elements ship JavaScript.
 */

/** Resolves a link target to a full pane URL — see buildCreateLink. */
export type CreateLink = (target: string) => string;

async function NumberOfDocuments() {
    // Was a client component that fetched /api/pieces?count=1 on mount and
    // showed "000" until it resolved. As a server component it is just the
    // number, with no request and no placeholder flash.
    const count = await getPieceCount();
    return <span>{count}</span>;
}

function componentsFor(createLink: CreateLink): Partial<Components> {
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aa: ({ to, href, children, ...rest }: any) => {
            const raw = String(to ?? href ?? "");
            const targets = raw
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map(createLink);
            return (
                <AALink targets={targets.length ? targets : ["/"]} {...rest}>
                    {children}
                </AALink>
            );
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lightimg: (props: any) => <LightImg {...props} />,

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cartesian: ({ contents, shuffle, limit }: any) => {
            let parsed: string[][] = [];
            try {
                parsed = typeof contents === "string" ? JSON.parse(contents) : (contents ?? []);
            } catch {
                // A malformed contents attribute rendered nothing before, and
                // still renders nothing, rather than taking the page down.
                parsed = [];
            }
            return <Cartesian contents={parsed} shuffle={Boolean(shuffle)} limit={Number(limit) || undefined} />;
        },

        // Plugins/Tree/Tree.jsx begins its render with `return false;` under a
        // `// todo is broken!` comment, so `<tree>` has rendered nothing on the
        // live site for years. Reproduced rather than revived — reviving it is
        // a product decision, not a migration one.
        tree: () => null,

        numberofdocuments: () => <NumberOfDocuments />,

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        iframe: ({ id, ...rest }: any) => (
            <div className="iframe-container">
                <iframe title={id} frameBorder={0} {...rest} />
            </div>
        ),

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        img: ({ bg, ...rest }: any) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                alt=""
                {...rest}
                style={{ backgroundColor: bg || "rgba(0,0,0,0.02)", ...(rest.style ?? {}) }}
                className={`max-w-full ${rest.className ?? ""}`}
            />
        ),
    };
}

export function renderContent(content: string | null | undefined, createLink: CreateLink): ReactNode {
    const tree = unified()
        .use(rehypeParse, { fragment: true })
        .parse(normaliseContent(content)) as Root;

    const clean = unified().use(rehypeSanitize, contentSchema).runSync(tree) as Root;

    return toJsxRuntime(clean, {
        Fragment,
        jsx,
        jsxs,
        components: componentsFor(createLink),
        // Custom elements the codex uses that have no component — `attr` is a
        // caption element with no handler in the legacy parser either, so it
        // renders as a bare unknown element exactly as it does today.
        passKeys: true,
        passNode: false,
        development: false,
    });
}
