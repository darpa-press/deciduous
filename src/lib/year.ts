/**
 * Printing a year.
 *
 * Years are stored as signed numbers, negative for BC — see asYear in
 * components/editors/fields, which reads them the other way. Kept here rather
 * than beside asYear because the people index is a Server Component and that
 * module is "use client"; this is the one form both sides can share.
 */

/** A stored year as the codex prints it, or an em dash for none. */
export function formatYear(value?: number | null): string {
    if (!value) return "—";
    return value > 0 ? String(value) : `BC${Math.abs(value)}`;
}
