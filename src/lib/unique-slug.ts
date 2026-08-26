import type { Model } from "mongoose";

/**
 * A slug nothing else is using.
 *
 * Both models used to derive the suffix from how *many* rows matched:
 *
 *     if (rows.length) this.slug = `${this.slug}-${rows.length + 1}`;
 *
 * which is only the next free number while nothing has ever been deleted.
 * Create "Ada Lovelace" twice and you get `ada-lovelace` and `ada-lovelace-2`;
 * delete the first, create a third, and one row matches — so it is handed
 * `ada-lovelace-2` as well. Person slugs are the routing key and there is no
 * unique index behind them, so the duplicate was written silently and one of
 * the two people became permanently unreachable: their pane, their editor and
 * their cache tag all resolved to the other.
 *
 * Looking at which suffixes are taken, rather than counting them, cannot
 * collide however the collection has been edited.
 */
export async function uniqueSlug(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: Model<any>,
    base: string,
    /** The document being saved, so an edit does not collide with itself. */
    ownId?: unknown
): Promise<string> {
    // `slugs` strips regex metacharacters, but the escape keeps this honest if
    // the slug source ever changes.
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escaped}(-[0-9]+)?$`, "i");

    const rows = await model.find({ slug: pattern }).select("slug").lean();

    const taken = new Set(
        rows
            .filter((row) => !ownId || String(row._id) !== String(ownId))
            .map((row) => String(row.slug ?? "").toLowerCase())
    );

    if (!taken.has(base.toLowerCase())) return base;

    for (let n = 2; ; n++) {
        const candidate = `${base}-${n}`;
        if (!taken.has(candidate.toLowerCase())) return candidate;
    }
}
