"use client";

import type { ReactNode } from "react";

/** A labelled row. The label column is fixed, as in the legacy form. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="form-flex">
            <label>{label}</label>
            <div className="form-field">{children}</div>
        </div>
    );
}

export function Checkbox({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="checkbox-label">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            {label}
        </label>
    );
}

/**
 * Colour, as a swatch and a text field over the same value — the text field
 * matters because the codex uses named and rgba() values a colour input
 * cannot represent.
 */
export function ColourField({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="combined-input">
            <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
                onChange={(e) => onChange(e.target.value)}
                aria-label="Background colour"
            />
            <input
                type="text"
                value={value}
                placeholder="Background colour"
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}
