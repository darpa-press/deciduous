"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { lookupPersonDates, type Candidate } from "@/app/editor-actions";
import { formatYear } from "@/lib/year";

/** Long enough that a name is a name, short enough to catch "Cao Xueqin". */
const MIN_NAME = 3;

/** Longer than WordFinder's 300ms: this leaves the machine, and Wikimedia counts. */
const SETTLE_MS = 600;

/**
 * What a candidate offers, in the codex's own notation — Wikidata's "-106"
 * reads as "BC106" here, as it does in the people index.
 */
function years(candidate: Candidate): string {
    const { birth, death } = candidate;
    if (birth === null && death === null) return "no dates";
    if (birth === null) return `died ${formatYear(death)}`;
    if (death === null) return `born ${formatYear(birth)}`;
    return `${formatYear(birth)}–${formatYear(death)}`;
}

/**
 * Offer the years for a person as they are named.
 *
 * There is no button to press. An author filling this form has already typed
 * the only thing a lookup needs, and asking them to then go and ask for it is
 * a step that exists for the implementation's sake rather than theirs. So the
 * search runs when the name settles, and only while a year is still missing —
 * which means it stops the moment it has been useful, and never runs at all
 * for the many people in this codex who are on no database anywhere.
 *
 * Nothing appears unless there is something to offer, and nothing is written
 * until a row is clicked. Once one is, the list collapses to what it filled:
 * the years themselves land far down the form, past the bio, so the report of
 * what happened has to be here, where the author is looking.
 */
export function DateFinder({
    name,
    birth,
    death,
    onPick,
}: {
    name: string;
    /** The years as the form holds them; a lookup stops once both are set. */
    birth: string;
    death: string;
    onPick: (candidate: Candidate) => void;
}) {
    const [pending, startTransition] = useTransition();
    /** Results carry the name they belong to, so an edited name drops them. */
    const [found, setFound] = useState<{ name: string; items: Candidate[] } | null>(null);
    const [taken, setTaken] = useState<{ name: string; candidate: Candidate } | null>(null);

    /** Bumped whenever a newer lookup supersedes an older one still in flight. */
    const latest = useRef(0);

    const trimmed = name.trim();
    // A name worth asking about, and a question still worth answering.
    const asking = trimmed.length >= MIN_NAME && (!birth.trim() || !death.trim());

    useEffect(() => {
        if (!asking) return;

        const timer = setTimeout(() => {
            const ticket = ++latest.current;
            startTransition(async () => {
                // The action answers [] rather than throwing when Wikidata
                // cannot be reached, so there is nothing here to report: a
                // suggestion that cannot be made is simply not made.
                const items = await lookupPersonDates(trimmed).catch(() => []);
                if (ticket === latest.current) setFound({ name: trimmed, items });
            });
        }, SETTLE_MS);

        return () => clearTimeout(timer);
    }, [trimmed, asking]);

    function pick(candidate: Candidate) {
        setTaken({ name: trimmed, candidate });
        onPick(candidate);
    }

    if (taken && taken.name === trimmed) {
        const { candidate } = taken;
        return (
            <div className="date-finder">
                {/* The description did its work in the list, choosing
                    between people; naming the one chosen is enough now, and
                    it usually carries the same years the fields just took. */}
                <div className="date-finder-taken">
                    From Wikidata: {candidate.name}, {years(candidate)}
                </div>
            </div>
        );
    }

    // Only what belongs to the name currently in the field. No matches shows
    // nothing at all: half a name matches nobody, and saying so on the way to
    // typing the rest would be noise, not news.
    const visible = found && found.name === trimmed ? found.items : [];

    if (visible.length === 0) {
        return pending ? (
            <div className="date-finder">
                <span className="quiet">…</span>
            </div>
        ) : null;
    }

    return (
        <div className="date-finder">
            <div className="word-finder-results date-finder-results">
                {visible.map((candidate) => {
                    const dated = candidate.birth !== null || candidate.death !== null;
                    return (
                        <button
                            type="button"
                            key={candidate.id}
                            className="word-finder-result"
                            onClick={() => pick(candidate)}
                            title={dated ? "Fill these years" : "No years to fill"}
                        >
                            <span className={`date-finder-years ${dated ? "" : "quiet"}`}>
                                {years(candidate)}
                            </span>
                            <span className="date-finder-who">
                                {candidate.name}
                                {candidate.description && (
                                    <span className="quiet"> — {candidate.description}</span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
