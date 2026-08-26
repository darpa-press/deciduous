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

/** How long the layout is allowed to move freely before the brake comes on. */
const FREE_MS = 4000;
/** How long the brake takes to bring the layout to a standstill. */
const BRAKE_MS = 2500;
/** How often the brake is tightened while it is easing on. */
const BRAKE_STEP_MS = 100;
/** The most a single frame may contribute — see the timing note below. */
const MAX_FRAME_MS = 100;

/** vis's own defaults for the two values the brake works against. */
const FREE_DAMPING = 0.09;
const FREE_MAX_VELOCITY = 50;
/**
 * Where the brake ends up: heavy drag, and a speed limit low enough that a
 * node moving flat out along both axes is still slower than `MIN_VELOCITY` —
 * which is what lets vis call the layout stable and stop of its own accord.
 */
const BRAKED_DAMPING = 0.9;
const BRAKED_MAX_VELOCITY = 0.4;
/** The velocity below which vis considers the layout at rest. */
const MIN_VELOCITY = 0.75;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

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
        minVelocity: MIN_VELOCITY,
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
        // would otherwise simulate forever and hold a core at 100%. Rather
        // than cutting the motion dead on a timer, ease the layout to a halt:
        // let it move freely for a moment, then wind the damping up and the
        // speed limit down until the nodes are barely creeping. That final
        // speed limit sits below `minVelocity`, so vis calls the layout stable
        // and stops the simulation itself; freezing afterwards is only the
        // tidy-up that keeps physics from picking back up later.
        let frame = 0;
        // Time is counted in frames actually drawn rather than off the clock:
        // vis steps the physics from the render loop, so a tab in the
        // background makes no progress and must lose no ground — otherwise
        // the graph is braked and frozen while still in its opening huddle.
        // A gap between frames counts for one frame at most, for the same
        // reason.
        let elapsed = 0;
        let previous = 0;
        let applied = -Infinity;

        const freeze = () => {
            cancelAnimationFrame(frame);
            network.setOptions({ physics: false });
        };

        const brake = (now: number) => {
            if (previous) elapsed += Math.min(now - previous, MAX_FRAME_MS);
            previous = now;

            if (elapsed >= FREE_MS && elapsed - applied >= BRAKE_STEP_MS) {
                applied = elapsed;
                // Eased in, so the brake bites gently and then firmly.
                const t = Math.min((elapsed - FREE_MS) / BRAKE_MS, 1);
                const eased = t * t;
                network.setOptions({
                    physics: {
                        barnesHut: {
                            damping: lerp(FREE_DAMPING, BRAKED_DAMPING, eased),
                        },
                        maxVelocity: lerp(
                            FREE_MAX_VELOCITY,
                            BRAKED_MAX_VELOCITY,
                            eased,
                        ),
                    },
                });
                // A backstop: by the end of the ramp nothing is moving fast
                // enough to see, and "stabilized" has normally fired already.
                if (t === 1) return freeze();
            }

            frame = requestAnimationFrame(brake);
        };

        frame = requestAnimationFrame(brake);

        // Whenever the layout comes to rest of its own accord — which is what
        // the brake is for, but a small graph can get there on its own first.
        network.once("stabilized", freeze);

        network.on("selectNode", (event: { nodes: string[] }) => {
            const node = nodes.find((n) => n.id === event.nodes[0]);
            if (!node) return;
            const segments = pathnameRef.current.split("/").filter(Boolean);
            pushPane(buildCreateLink(segments, index)(String(node.link), false));
        });

        return () => {
            cancelAnimationFrame(frame);
            network.destroy();
        };
    }, [nodes, edges, index]);

    return <div ref={container} className="graph-canvas" />;
}
