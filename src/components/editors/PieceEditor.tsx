"use client";

import { useState, useTransition } from "react";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";

import { CodeEditor } from "./CodeEditor";
import { Field, Checkbox, ColourField, asYear } from "./fields";
import { FileUpload } from "./FileUpload";
import { DateFinder } from "./DateFinder";
import { WordFinder } from "./WordFinder";
import { savePiece, deletePiece, createPerson, type PieceInput } from "@/app/editor-actions";
import { buildCreateLink, segmentsFromPathname } from "@/lib/panes";
import { pushPane } from "@/lib/navigate";
import { usePathname } from "next/navigation";

/**
 * Editing a piece. Ported from Pages/Edit/PieceEdit.
 *
 * Saving navigates the pane to the piece; deleting navigates it to the index —
 * both through the pane stack rather than a route change, so the other pane
 * stays put.
 */

export interface Option {
    value: string;
    label: string;
}

export interface PieceEditorProps {
    index: number;
    /** Absent when creating. */
    id?: string | null;
    page?: number | null;
    /** Document version this form was loaded from. */
    version?: number | null;
    initial: {
        title: string;
        content: string;
        readme: string;
        background: string;
        stub: boolean;
        fullWidth: boolean;
        parent: string | null;
        lovers: string[];
        persons: string[];
        word: { id: string; label: string }[];
    };
    pieceOptions: Option[];
    personOptions: Option[];
}

export function PieceEditor({
    index,
    id,
    page,
    version,
    initial,
    pieceOptions,
    personOptions,
}: PieceEditorProps) {
    const pathname = usePathname();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    /**
     * A save stays committed until the pane is replaced.
     *
     * `pending` clears the moment the action resolves, but the editor stays
     * mounted until the pane finishes a server round-trip — so on a slow link
     * the button came back to life on a form that had already created a piece,
     * and a second click created a second one.
     */
    const [committed, setCommitted] = useState(false);

    const [title, setTitle] = useState(initial.title);
    const [content, setContent] = useState(initial.content);
    const [readme, setReadme] = useState(initial.readme);
    const [background, setBackground] = useState(initial.background);
    const [stub, setStub] = useState(initial.stub);
    const [fullWidth, setFullWidth] = useState(initial.fullWidth);
    const [parent, setParent] = useState<string | null>(initial.parent);
    const [lovers, setLovers] = useState<string[]>(initial.lovers);
    const [persons, setPersons] = useState<string[]>(initial.persons);
    const [words, setWords] = useState(initial.word);
    /**
     * People can be made from here, so the list is state rather than the prop.
     *
     * A person made here is written straight away — the piece holds ids, so
     * there is nothing to point at until the person exists — and the new option
     * is appended so it can be selected without a round-trip through the pane.
     */
    const [people, setPeople] = useState(personOptions);
    /**
     * A name typed into the People field opens this rather than writing at
     * once: a person is worth very little without their dates, and the person
     * index reads as a chronology. Everything else about them — bio, relations
     * — belongs in their own editor, a pane away.
     */
    const [draft, setDraft] = useState<{
        name: string;
        birth: string;
        death: string;
        wikidata: string;
    } | null>(null);
    const [note, setNote] = useState<string | null>(null);

    const go = (target: string) => {
        pushPane(buildCreateLink(segmentsFromPathname(pathname), index)(target, false));
    };

    function onSave() {
        setError(null);
        const input: PieceInput = {
            id: id ?? null,
            version: version ?? null,
            title,
            content,
            readme,
            background,
            stub,
            fullWidth,
            parent,
            lovers,
            persons,
            word: words.map((w) => w.id),
        };
        startTransition(async () => {
            try {
                const { page: savedPage } = await savePiece(input);
                setCommitted(true);
                go(String(savedPage));
            } catch (e) {
                setError(e instanceof Error ? e.message : "Could not save.");
            }
        });
    }

    function onCreatePerson() {
        if (!draft) return;
        setError(null);
        setNote(null);
        startTransition(async () => {
            try {
                const person = await createPerson({
                    name: draft.name,
                    birth: asYear(draft.birth),
                    death: asYear(draft.death),
                    wikidata: draft.wikidata,
                });
                setPeople((current) =>
                    current.some((o) => o.value === person.id)
                        ? current
                        : [...current, { value: person.id, label: person.name }]
                );
                setPersons((current) =>
                    current.includes(person.id) ? current : [...current, person.id]
                );
                // A name that already belonged to someone selects them instead
                // of making a second record — say so, since the dates just
                // typed were theirs to keep and have been left alone.
                if (!person.created) {
                    setNote(`${person.name} already existed, so they were added as they are.`);
                }
                setDraft(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Could not create that person.");
            }
        });
    }

    function onDelete() {
        if (!id || page == null) return;
        if (!window.confirm("Are you sure you want to delete this piece?")) return;
        setError(null);
        startTransition(async () => {
            try {
                await deletePiece(id, page);
                setCommitted(true);
                go("index");
            } catch (e) {
                setError(e instanceof Error ? e.message : "Could not delete.");
            }
        });
    }

    const byValue = (options: Option[], values: string[]) =>
        options.filter((o) => values.includes(o.value));

    return (
        <div className="form-page">
            <input
                className="edit-title"
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />

            <CodeEditor value={content} onChange={setContent} />

            <FileUpload />

            <Field label="Parent">
                <Select
                    className="select"
                    classNamePrefix="select"
                    isClearable
                    options={pieceOptions}
                    value={pieceOptions.find((o) => o.value === parent) ?? null}
                    onChange={(option) => setParent(option ? option.value : null)}
                />
            </Field>

            <Field label="Lovers">
                <Select
                    className="select"
                    classNamePrefix="select"
                    isMulti
                    options={pieceOptions}
                    value={byValue(pieceOptions, lovers)}
                    onChange={(options) => setLovers(options.map((o) => o.value))}
                />
            </Field>

            <Field label="People">
                <div className="person-field">
                    <CreatableSelect
                        className="select"
                        classNamePrefix="select"
                        isMulti
                        isLoading={pending}
                        options={people}
                        value={byValue(people, persons)}
                        onChange={(options) => setPersons(options.map((o) => o.value))}
                        onCreateOption={(name) => {
                            setNote(null);
                            setDraft({ name, birth: "", death: "", wikidata: "" });
                        }}
                        formatCreateLabel={(input) => `Add ${input} as a new person`}
                    />

                    {draft && (
                        <div
                            className="person-draft"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") onCreatePerson();
                                if (e.key === "Escape") setDraft(null);
                            }}
                        >
                            <input
                                type="text"
                                placeholder="Name"
                                value={draft.name}
                                autoFocus
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            />
                            <input
                                type="text"
                                className="person-draft-year"
                                placeholder="Born"
                                title="Year, negative for BC"
                                value={draft.birth}
                                onChange={(e) => setDraft({ ...draft, birth: e.target.value })}
                            />
                            <input
                                type="text"
                                className="person-draft-year"
                                placeholder="Died"
                                title="Year, negative for BC"
                                value={draft.death}
                                onChange={(e) => setDraft({ ...draft, death: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={onCreatePerson}
                                disabled={pending || !draft.name.trim()}
                            >
                                Create
                            </button>
                            <button type="button" onClick={() => setDraft(null)}>
                                Cancel
                            </button>
                        </div>
                    )}

                    {/*
                      * Below the draft row, not inside it: .person-draft is a
                      * single flex line of fixed-width inputs.
                      */}
                    {draft && (
                        <DateFinder
                            name={draft.name}
                            birth={draft.birth}
                            death={draft.death}
                            onPick={(candidate) =>
                                setDraft((current) =>
                                    current === null
                                        ? current
                                        : {
                                              ...current,
                                              birth:
                                                  candidate.birth !== null
                                                      ? String(candidate.birth)
                                                      : current.birth,
                                              death:
                                                  candidate.death !== null
                                                      ? String(candidate.death)
                                                      : current.death,
                                              wikidata: candidate.id,
                                          }
                                )
                            }
                        />
                    )}

                    {note && <div className="person-note">{note}</div>}
                </div>
            </Field>

            <Field label="Words">
                <WordFinder
                    selected={words}
                    onAdd={(word) =>
                        setWords((current) =>
                            current.some((w) => w.id === word.id) ? current : [...current, word]
                        )
                    }
                    onRemove={(id) => setWords((current) => current.filter((w) => w.id !== id))}
                />
            </Field>

            <Field label="BG colour">
                <ColourField value={background} onChange={setBackground} />
            </Field>

            <Field label="Précis">
                <textarea rows={4} value={readme} onChange={(e) => setReadme(e.target.value)} />
            </Field>

            <Field label="Stub">
                <Checkbox label="Stub" checked={stub} onChange={setStub} />
            </Field>

            <Field label="Full width">
                <Checkbox label="Full width" checked={fullWidth} onChange={setFullWidth} />
            </Field>

            {error && <div className="form-error">{error}</div>}
            {/* Saving over an open draft would quietly drop the person being
                typed, since they are not written until Create. */}
            {draft && <div className="form-error">Finish or cancel the new person first.</div>}

            <div className="form-buttons">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={pending || committed || draft !== null}
                >
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
