import React from "react";

import "./Tree.css";

import TreeOutlines from "./TreeOutlines.svg";

class TreeLayer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            onPath: [0, 0]
        };
        this.interval = null;
    }

    componentDidMount() {
        this.chooseOnPaths(this.props.paths);
        this.interval = setInterval(
            () => this.chooseOnPaths(this.props.paths),
            1500 + this.props.index * 10
        );
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    chooseOnPaths(paths) {
        this.setState({
            onPath: [
                Math.floor(Math.random() * paths.length),
                Math.floor(Math.random() * paths.length)
            ]
        });
    }

    render() {
        return (
            <g>
                {this.props.paths.map((path, index) => (
                    <path
                        key={index}
                        {...path}
                        className={`${path.className} ${
                            this.state.onPath.indexOf(index) !== -1
                                ? "path-on"
                                : "path-off"
                        }`}
                    />
                ))}
            </g>
        );
    }
}

export default class Tree extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            treeDrawing: false
        };
    }

    componentWillMount() {
        import("./TreeDrawing.json")
            .then(TreeDrawing => {
                this.setState({ treeDrawing: TreeDrawing });
            })
            .catch(err => {
                // Handle failure
            });
    }

    componentDidMount() {}

    render() {
        // todo is broken!
        return false;

        if (!this.state.treeDrawing) {
            return false;
        }
        return (
            <div className="tree">
                <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    x="0px"
                    y="0px"
                    viewBox="0 0 660 985"
                    style={{ enableBackground: "new 0 0 660 985" }}
                >
                    {Object.keys(this.state.treeDrawing).map((layer, index) => (
                        <TreeLayer
                            key={index}
                            index={index}
                            paths={this.state.treeDrawing[layer]}
                        />
                    ))}
                </svg>
                <img alt="" src={TreeOutlines} />
            </div>
        );
    }
}
