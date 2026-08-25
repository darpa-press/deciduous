import { getGraph } from "@/lib/queries";
import { buildCreateLink } from "@/lib/panes";
import { GraphCanvas, type GraphNode, type GraphEdge } from "./GraphCanvas";

/**
 * Fetches the graph and hands it to the canvas. The link for every node is
 * resolved to a pane URL here rather than in the browser, so the client
 * component needs no knowledge of the pane grammar.
 */
export async function GraphPane({ pathArray, index }: { pathArray: string[]; index: number }) {
    const { nodes, edges } = await getGraph();
    const link = buildCreateLink(pathArray, index);

    const graphNodes = JSON.parse(JSON.stringify(nodes)) as GraphNode[];
    const graphEdges = JSON.parse(JSON.stringify(edges)) as GraphEdge[];

    const hrefForLink: Record<string, string> = {};
    for (const node of graphNodes) {
        hrefForLink[String(node.link)] = link(String(node.link), false);
    }

    return <GraphCanvas nodes={graphNodes} edges={graphEdges} hrefForLink={hrefForLink} />;
}
