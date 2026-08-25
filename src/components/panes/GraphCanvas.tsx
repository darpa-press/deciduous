"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

import { buildCreateLink } from "@/lib/panes";
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
        font: { face: '"FigginsItalic"' },
        borderWidth: 1,
    },
    physics: {
        barnesHut: {
            avoidOverlap: 0.2,
            gravitationalConstant: -20000,
        },
        minVelocity: 0.75,
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
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!container.current) return;

        // Passed as plain arrays rather than DataSets: the legacy edges carry
        // no `id`, which a DataSet requires but the Network happily assigns
        // itself.
        const data = { nodes, edges } as unknown as Data;
        const network = new Network(container.current, data, options);

        network.on("selectNode", (event: { nodes: string[] }) => {
            const node = nodes.find((n) => n.id === event.nodes[0]);
            if (!node) return;
            const segments = pathname.split("/").filter(Boolean);
            router.push(buildCreateLink(segments, index)(String(node.link), false));
        });

        return () => network.destroy();
    }, [nodes, edges, index, pathname, router]);

    return <div ref={container} className="graph-canvas" />;
}
