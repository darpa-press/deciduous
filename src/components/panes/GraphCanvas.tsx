"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { buildCreateLink } from "@/lib/panes";
import { pushPane } from "@/lib/navigate";
import { Network, type Data, type Options } from "vis-network";

/**
 * The relationship graph.
 *
 * Ported from Pages/Graph, which used react-graph-vis — an unmaintained
 * wrapper around vis-network. vis-network itself is used directly here; the
 * layout, physics and node/edge styling options are carried over unchanged, so
 * the graph settles into the same shape.
 *
 * Node colours carry meaning, assembled server-side in lib/queries: blue
 * borders for people, black for pieces; black edges for parentage, blue dashed
 * for a person appearing in a piece, red for a "lover" link.
 */

export interface GraphNode {
    id: string;
    label: string;
    link: string | number;
    type: "person" | "piece";
    color: { background: string; border: string };
    page?: number;
    slug?: string;
}

export interface GraphEdge {
    from: string;
    to: string;
    color: { color: string; inherit: boolean };
    dashes?: boolean;
}

/** How long to let the layout settle before freezing it. */
const SETTLE_MS = 6000;

const options: Options = {
    autoResize: true,
    layout: { hierarchical: false },
    edges: {
        color: { inherit: false },
        width: 1,
    },
    nodes: {
        shape: "dot",
        size: 12,
        // The legacy left this at the vis default of 14, with a commented-out
        // experiment at 32. The view fits the whole graph, so at 14 the labels
        // were sub-pixel; 32 is the author's own value and is readable at that
        // zoom.
        font: { face: '"FigginsItalic"', size: 32 },
        borderWidth: 1,
    },
    physics: {
        barnesHut: {
            avoidOverlap: 0.2,
            gravitationalConstant: -20000,
        },
        minVelocity: 0.75,
        // No stabilization burst. vis-network 10 runs stabilization
        // synchronously, and with this graph — 178 nodes, 286 edges, and a
        // support node per smoothed edge — it locks the main thread hard
        // enough to freeze the tab. Letting the layout settle live avoids
        // that, and looks the same once it comes to rest.
        stabilization: { enabled: false },
    },
};

export function GraphCanvas({
    nodes,
    edges,
    index,
}: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    /** Which pane this graph occupies. */
    index: number;
}) {
    const container = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    // The click handler needs the *current* path, but the network must not be
    // rebuilt when some other pane changes — tearing it down would restart the
    // simulation and throw away the layout. So the path is read through a ref
    // and deliberately kept out of the effect's dependencies.
    const pathnameRef = useRef(pathname);
    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    useEffect(() => {
        if (!container.current) return;

        // Passed as plain arrays rather than DataSets: the legacy edges carry
        // no `id`, which a DataSet requires but the Network happily assigns
        // itself.
        const data = { nodes, edges } as unknown as Data;
        const network = new Network(container.current, data, options);

        // Physics has no natural end without a stabilization phase, so it
        // would otherwise simulate forever and hold a core at 100%. Freeze the
        // layout once it settles, with a timeout in case it never does.
        const freeze = () => network.setOptions({ physics: false });
        const settleTimer = setTimeout(freeze, SETTLE_MS);
        network.once("stabilized", () => {
            clearTimeout(settleTimer);
            freeze();
        });

        network.on("selectNode", (event: { nodes: string[] }) => {
            const node = nodes.find((n) => n.id === event.nodes[0]);
            if (!node) return;
            const segments = pathnameRef.current.split("/").filter(Boolean);
            pushPane(buildCreateLink(segments, index)(String(node.link), false));
        });

        return () => {
            clearTimeout(settleTimer);
            network.destroy();
        };
    }, [nodes, edges, index]);

    return <div ref={container} className="graph-canvas" />;
}
