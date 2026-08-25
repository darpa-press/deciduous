import { cacheTag } from "next/cache";

import * as data from "@/lib/data";

/**
 * Cached read layer.
 *
 * Each wrapper is a `use cache` boundary tagged by what it reads. That is what
 * stops the pane stack re-querying the world on every navigation: when one
 * segment of /2/125 changes, the other pane's data is a cache hit, so it
 * neither touches the database nor re-suspends — which is what made unchanged
 * panes visibly reload.
 *
 * The tags are the invalidation handles the editors will call revalidateTag on
 * in Phase 5: "pieces", "persons", "words", plus per-item tags.
 *
 * Caching is separated from the queries themselves so the data layer stays
 * runnable outside Next, where the golden-snapshot gate exercises it.
 */

export async function getPieceByPage(page: number) {
    "use cache";
    cacheTag("pieces", `piece-${page}`);
    return data.getPieceByPage(page);
}

export async function getPieceCount() {
    "use cache";
    cacheTag("pieces");
    return data.getPieceCount();
}

export async function getPersonBySlug(slug: string) {
    "use cache";
    cacheTag("persons", `person-${slug}`, "pieces");
    return data.getPersonBySlug(slug);
}

export async function getWordById(id: string) {
    "use cache";
    cacheTag("words", `word-${id}`, "pieces");
    return data.getWordById(id);
}

export async function getChildPieces(parentId: string) {
    "use cache";
    cacheTag("pieces");
    return data.getChildPieces(parentId);
}

export async function getPieceTree() {
    "use cache";
    cacheTag("pieces");
    return data.getPieceTree();
}

export async function getAllPieces(options: { sort?: string; order?: 1 | -1; limit?: number } = {}) {
    "use cache";
    cacheTag("pieces");
    return data.getAllPieces(options);
}

export async function getAllPersons() {
    "use cache";
    cacheTag("persons");
    return data.getAllPersons();
}

export async function getWordTree() {
    "use cache";
    cacheTag("words");
    return data.getWordTree();
}

export async function searchPieces(q: string) {
    "use cache";
    cacheTag("pieces");
    return data.searchPieces(q);
}

export async function getGraph() {
    "use cache";
    cacheTag("pieces", "persons");
    return data.getGraph();
}
