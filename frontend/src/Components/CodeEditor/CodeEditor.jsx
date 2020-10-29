import React from "react";

import "brace";
import AceEditor from "react-ace";

import "brace/mode/html";
//import 'brace/theme/solarized_dark';
import "brace/theme/tomorrow";

export default class CodeEditor extends React.Component {
    render() {
        return (
            <AceEditor
                editorProps={{ $blockScrolling: true }}
                fontSize={14}
                mode="html"
                name="content"
                onLoad={editor => {
                    editor.renderer.setScrollMargin(24, 24, 0, 0);
                }}
                onChange={this.props.onChange}
                theme="tomorrow"
                value={this.props.value}
                wrapEnabled={true}
                style={{ border: "1px solid #e8e8e8" }}
            />
        );
    }
}
