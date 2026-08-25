"use client";

import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";

/**
 * The content editor.
 *
 * Piece content is authored as HTML with the codex's own custom elements, so
 * this is a code editor rather than a rich-text one — as it was before, when
 * it used react-ace. That ran on `brace`, which is unmaintained; this is
 * CodeMirror 6.
 */
export function CodeEditor({
    value,
    onChange,
    minHeight = "24rem",
}: {
    value: string;
    onChange: (value: string) => void;
    minHeight?: string;
}) {
    return (
        <div className="code-editor">
            <CodeMirror
                value={value}
                onChange={onChange}
                extensions={[html()]}
                minHeight={minHeight}
                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
            />
        </div>
    );
}
