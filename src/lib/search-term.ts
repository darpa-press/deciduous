/**
 * Turning what someone typed into a Mongo `$text` query.
 *
 * Kept out of the action, and free of Next, so the rules can be tested on
 * their own — they are the guard on a public, unauthenticated entry point and
 * are worth pinning down.
 *
 * The legacy client wrapped the term in quotes before sending it, which turns
 * a $text query into a phrase match, so "green paper" finds that phrase rather
 * than any piece containing either word. Preserved.
 */

/** Matches the search overlay's own minimum: one letter matches too much. */
export const MIN_TERM = 2;
/** Long enough for any phrase worth searching. */
export const MAX_TERM = 128;

/**
 * The query to run, or null when there is nothing worth running.
 *
 * Both bounds used to live only in the client component while `searchPieces`
 * is a `use cache` boundary keyed on its argument — so an anonymous caller
 * could mint an unbounded number of persistent cache entries, each holding a
 * full result set and each a fresh text scan, one per distinct string.
 */
export function searchQuery(term: string): string | null {
    // A double quote closes the phrase early and the remainder degrades from a
    // phrase match to a loose OR — `a"b unicorn` returned pieces matching
    // neither. There is no escape for it inside a $text phrase, so it comes out.
    const trimmed = term.replace(/"/g, " ").trim().slice(0, MAX_TERM);
    if (trimmed.length < MIN_TERM) return null;
    return `"${trimmed}"`;
}
