"use client";

import { useState, useTransition } from "react";
import Select from "react-select";

import { CodeEditor } from "./CodeEditor";
import { Field, Checkbox, ColourField } from "./fields";
import { FileUpload } from "./FileUpload";
import { WordFinder } from "./WordFinder";
import { savePiece, deletePiece, type PieceInput } from "@/app/editor-actions";
import { buildCreateLink } from "@/lib/panes";
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
    initial,
    pieceOptions,
    personOptions,
}: PieceEditorProps) {
    const pathname = usePathname();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

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

    const go = (target: string) => {
        const segments = pathname.split("/").filter(Boolean);
        pushPane(buildCreateLink(segments, index)(target, false));
    };

    function onSave() {
        setError(null);
        const input: PieceInput = {
            id: id ?? null,
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
                go(String(savedPage));
            } catch (e) {
                setError(e instanceof Error ? e.message : "Could not save.");
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
                <Select
                    className="select"
                    classNamePrefix="select"
                    isMulti
                    options={personOptions}
                    value={byValue(personOptions, persons)}
                    onChange={(options) => setPersons(options.map((o) => o.value))}
                />
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

            <div className="form-buttons">
                <button type="button" onClick={onSave} disabled={pending}>
                    {pending ? "…" : "Save"}
                </button>
                {id && (
                    <button type="button" style={{ color: "red" }} onClick={onDelete} disabled={pending}>
                        Delete
                    </button>
                )}
            </div>
        </div>
    );
}
