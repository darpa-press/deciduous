import { getGraph } from "@/lib/queries";
import { GraphCanvas, type GraphNode, type GraphEdge } from "./GraphCanvas";

/** Fetches the graph and hands it to the canvas. */
export async function GraphPane({ index }: { index: number }) {
    const { nodes, edges } = await getGraph();

    const graphNodes = JSON.parse(JSON.stringify(nodes)) as GraphNode[];
    const graphEdges = JSON.parse(JSON.stringify(edges)) as GraphEdge[];

    // The node's `link` is a bare segment; the canvas resolves it against the
    // live pathname, because this pane persists and cannot see its neighbours.
    return <GraphCanvas nodes={graphNodes} edges={graphEdges} index={index} />;
}
