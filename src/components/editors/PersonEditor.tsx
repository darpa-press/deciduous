"use client";

import { useState, useTransition } from "react";
import Select from "react-select";
import { usePathname } from "next/navigation";

import { CodeEditor } from "./CodeEditor";
import { DateFinder } from "./DateFinder";
import { Field, asYear } from "./fields";
import { savePerson, deletePerson, type PersonInput } from "@/app/editor-actions";
import { buildCreateLink, segmentsFromPathname } from "@/lib/panes";
import { pushPane } from "@/lib/navigate";
import type { Option } from "./PieceEditor";

/** Editing a person. Ported from Pages/Edit/PersonEdit. */
export function PersonEditor({
    index,
    id,
    slug,
    version,
    initial,
    personOptions,
}: {
    index: number;
    id?: string | null;
    slug?: string | null;
    /** Document version this form was loaded from. */
    version?: number | null;
    initial: {
        name: string;
        bio: string;
        birth: string;
        death: string;
        wikidata: string;
        relation: { relatedPerson: string; relatedReason: string }[];
    };
    personOptions: Option[];
}) {
    const pathname = usePathname();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    /** As in PieceEditor: the form outlives the action, so a save is final. */
    const [committed, setCommitted] = useState(false);

    const [name, setName] = useState(initial.name);
    const [bio, setBio] = useState(initial.bio);
    const [birth, setBirth] = useState(initial.birth);
    const [death, setDeath] = useState(initial.death);
    const [wikidata, setWikidata] = useState(initial.wikidata);
    const [relation, setRelation] = useState(initial.relation);

    const go = (target: string) => {
        pushPane(buildCreateLink(segmentsFromPathname(pathname), index)(target, false));
    };

    function onSave() {
        setError(null);
        const input: PersonInput = {
            id: id ?? null,
            version: version ?? null,
            name,
            bio,
            birth: asYear(birth),
            death: asYear(death),
            wikidata,
            relation,
        };
        startTransition(async () => {
            try {
                const { slug: savedSlug } = await savePerson(input);
                setCommitted(true);
                go(`p-${savedSlug}`);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Could not save.");
            }
        });
    }

    function onDelete() {
        if (!id || !slug) return;
        if (!window.confirm("Are you sure you want to delete this person?")) return;
        setError(null);
        startTransition(async () => {
            try {
                await deletePerson(id, slug);
                setCommitted(true);
                go("person");
            } catch (e) {
                setError(e instanceof Error ? e.message : "Could not delete.");
            }
        });
    }

    const updateRelation = (i: number, patch: Partial<(typeof relation)[number]>) =>
        setRelation(relation.map((r, j) => (i === j ? { ...r, ...patch } : r)));

    return (
        <div className="form-page">
            <input
                className="edit-title"
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />

            <DateFinder
                name={name}
                birth={birth}
                death={death}
                onPick={(candidate) => {
                    // Only ever fills. A candidate Wikidata has no settled year
                    // for must not wipe one the author has already judged.
                    if (candidate.birth !== null) setBirth(String(candidate.birth));
                    if (candidate.death !== null) setDeath(String(candidate.death));
                    setWikidata(candidate.id);
                }}
            />

            {/* The bio is stored as HTML and rendered as such on the person pane. */}
            <CodeEditor value={bio} onChange={setBio} minHeight="12rem" />

            <Field label="Born">
                <input
                    type="text"
                    value={birth}
                    placeholder="Year, negative for BC"
                    onChange={(e) => setBirth(e.target.value)}
                />
            </Field>

            <Field label="Died">
                <input
                    type="text"
                    value={death}
                    placeholder="Year, negative for BC"
                    onChange={(e) => setDeath(e.target.value)}
                />
            </Field>

            <Field label="Relations">
                <div className="relations">
                    {relation.map((entry, i) => (
                        <div className="relation-row" key={i}>
                            <Select
                                className="select"
                                classNamePrefix="select"
                                isClearable
                                options={personOptions}
                                value={personOptions.find((o) => o.value === entry.relatedPerson) ?? null}
                                onChange={(option) =>
                                    updateRelation(i, { relatedPerson: option ? option.value : "" })
                                }
                            />
                            <input
                                type="text"
                                placeholder="Reason"
                                value={entry.relatedReason}
                                onChange={(e) => updateRelation(i, { relatedReason: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => setRelation(relation.filter((_, j) => j !== i))}
                                title="Remove"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() =>
                            setRelation([...relation, { relatedPerson: "", relatedReason: "" }])
                        }
                    >
                        Add relation
                    </button>
                </div>
            </Field>

            {error && <div className="form-error">{error}</div>}

            <div className="form-buttons">
                <button type="button" onClick={onSave} disabled={pending || committed}>
                    {pending ? "…" : "Save"}
                </button>
                {id && (
                    <button
                        type="button"
                        style={{ color: "red" }}
                        onClick={onDelete}
                        disabled={pending || committed}
                    >
                        Delete
                    </button>
                )}
            </div>
        </div>
    );
}
