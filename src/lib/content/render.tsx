import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import { visit } from "unist-util-visit";
import type { Element, Root } from "hast";
import type { ReactNode } from "react";

import { contentSchema } from "./schema";
import { normaliseContent } from "./normalise";
import { scopeCss } from "./scope-css";
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

async function NumberOfDocuments() {
    // Was a client component that fetched /api/pieces?count=1 on mount and
    // showed "000" until it resolved. As a server component it is just the
    // number, with no request and no placeholder flash.
    const count = await getPieceCount();
    return <span>{count}</span>;
}

/**
 * A colour, or nothing.
 *
 * `bg` is declared as a colour but reaches React as a raw CSS fragment, so
 * `bg="red;position:fixed;inset:0;z-index:99999"` used to serialise straight
 * into the style attribute and cover the viewport. Anything that is not a
 * single colour token is dropped in favour of the default.
 */
const COLOUR = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|rgba|hsl|hsla)\([0-9.,%\s/-]+\))$/i;

export function cssColour(value: unknown, fallback: string): string {
    const candidate = typeof value === "string" ? value.trim() : "";
    return COLOUR.test(candidate) ? candidate : fallback;
}

/**
 * Presence means true.
 *
 * `<cartesian shuffle>` — the form the component's own doc comment shows —
 * parses to `shuffle=""`, and `Boolean("")` is false, so the one documented
 * spelling did not shuffle while `shuffle="false"` did.
 */
function attrFlag(value: unknown): boolean {
    if (value === undefined || value === null || value === false) return false;
    if (typeof value === "string") return value.toLowerCase() !== "false";
    return Boolean(value);
}

/** `limit="0"` means no rows, not "no limit". */
function attrCount(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function componentsFor(index: number): Partial<Components> {
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aa: ({ to, href, children, ...rest }: any) => {
            const raw = String(to ?? href ?? "");
            const targets = raw
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            return (
                <AALink targets={targets} index={index} {...rest}>
                    {children}
                </AALink>
            );
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lightimg: ({ bg, ...rest }: any) => <LightImg {...rest} bg={cssColour(bg, "")} />,

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
            return (
                <Cartesian
                    contents={parsed}
                    shuffle={attrFlag(shuffle)}
                    limit={attrCount(limit)}
                />
            );
        },

        // Plugins/Tree/Tree.jsx begins its render with `return false;` under a
        // `// todo is broken!` comment, so `<tree>` has rendered nothing on the
        // live site for years. Reproduced rather than revived — reviving it is
        // a product decision, not a migration one.
        tree: () => null,

        numberofdocuments: () => <NumberOfDocuments />,

        // `id` names the embed; it is the accessible name only when the author
        // gave no title. Both defaults sit after the spread so an authored
        // attribute wins rather than being silently overridden by it.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        iframe: ({ id, title, frameBorder, ...rest }: any) => (
            <div className="iframe-container">
                <iframe
                    {...rest}
                    id={id}
                    title={title ?? id}
                    frameBorder={frameBorder ?? 0}
                />
            </div>
        ),

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        img: ({ bg, ...rest }: any) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                alt=""
                {...rest}
                style={{
                    backgroundColor: cssColour(bg, "rgba(0,0,0,0.02)"),
                    ...(rest.style ?? {}),
                }}
                className={`max-w-full ${rest.className ?? ""}`}
            />
        ),
    };
}

/** Rewrite each <style> block so its rules cannot reach another piece. */
function scopeStyles(tree: Root, scope: string) {
    visit(tree, "element", (node: Element) => {
        if (node.tagName !== "style") return;
        for (const child of node.children) {
            if (child.type === "text") child.value = scopeCss(child.value, scope);
        }
    });
}

export function renderContent(
    content: string | null | undefined,
    index: number,
    /** Wrapper class the piece's own CSS is confined to. */
    scope?: string
): ReactNode {
    const tree = unified()
        .use(rehypeParse, { fragment: true })
        .parse(normaliseContent(content)) as Root;

    const clean = unified().use(rehypeSanitize, contentSchema).runSync(tree) as Root;

    if (scope) scopeStyles(clean, scope);

    return toJsxRuntime(clean, {
        Fragment,
        jsx,
        jsxs,
        components: componentsFor(index),
        // Custom elements the codex uses that have no component — `attr` is a
        // caption element with no handler in the legacy parser either, so it
        // renders as a bare unknown element exactly as it does today.
        passKeys: true,
        passNode: false,
        development: false,
        // A style attribute the CSS parser cannot read throws by default, and
        // renderContent is called synchronously inside a server component with
        // no error boundary above it — so one dropped colon in one piece
        // (`style="color"`) turned into a 500 on that piece, on /all, and on
        // every pane stack containing it. Skip the attribute instead.
        ignoreInvalidStyle: true,
    });
}
