import React from "react";
import { Parser, ProcessNodeDefinitions } from "html-to-react";
import { Link } from "react-router-dom";
import shuffle from "shuffle-array";

import Tree from "Plugins/Tree/Tree";
import LightImg from "Plugins/LightImg/LightImg";
import Cartesian from "Plugins/Cartesian/Cartesian";
import NumberOfDocuments from "Plugins/NumberOfDocuments/NumberOfDocuments";
import Image from "react-graceful-image";

import createStyleJsonFromString from "./createStyleJsonFromString";

export default class ContentParser extends React.Component {
    constructor(props) {
        super(props);

        this.parser = new Parser();

        this.processDefs = new ProcessNodeDefinitions(React);
        this.processingInstructions = [
            {
                shouldProcessNode: node => node.name === "iframe",
                processNode: node => (
                    <div className="iframe-container">
                        <iframe
                            title={node.id}
                            {...node.attribs}
                            frameBorder={0}
                        />
                    </div>
                )
            },
            {
                shouldProcessNode: node => node.name === "img",
                processNode: node => (
                    <Image
                        alt={node.attribs.alt || ""}
                        key={node.attribs.src}
                        {...node.attribs}
                        placeholderColor={"rgba(0,0,0,0.02)"}
                        noLazyLoad={true}
                        style={
                            node.attribs.style
                                ? createStyleJsonFromString(
                                      node.attribs.style // TODO: doesn't seem to be working well
                                  )
                                : null
                        }
                    />
                )
            },
            {
                shouldProcessNode: node => node.name === "tree",
                processNode: node => <Tree key="123" />
            },
            {
                shouldProcessNode: node => node.name === "cartesian",
                processNode: node => (
                    <Cartesian
                        key="hello"
                        {...node.attribs}
                        shuffle={!!node.attribs.shuffle}
                        limit={Number(node.attribs.limit)}
                        contents={JSON.parse(node.attribs.contents)}
                    />
                )
            },
            {
                shouldProcessNode: node => node.name === "lightimg",
                processNode: node => {
                    node.attribs.className = node.attribs.classname;
                    delete node.attribs.classname;
                    return (
                        <LightImg key={node.attribs.src} {...node.attribs} />
                    );
                }
            },
            {
                shouldProcessNode: node => node.name === "numberofdocuments",
                processNode: node => <NumberOfDocuments key={"docs"} />
            },
            {
                shouldProcessNode: node => node.name === "aa",
                processNode: (node, children, test) => {
                    node.attribs.className = node.attribs.classname;
                    delete node.attribs.classname;

                    let possibleLinkString =
                        node.attribs.to || node.attribs.href || "";
                    let possibleLinks = possibleLinkString.split(",");
                    shuffle(possibleLinks);

                    return (
                        <Link
                            {...node.attribs}
                            to={this.props.createLink(possibleLinks[0], true)}
                            key={node.attribs.to}
                        >
                            {children}
                        </Link>
                    );
                }
            },
            {
                // Anything else
                shouldProcessNode: node => {
                    return true;
                },
                processNode: this.processDefs.processDefaultNode
            }
        ];
    }

    processContent(contentString) {
        let content = contentString
            ? contentString.replace(/\r?\n|\r/g, "") // remove line breaks?
            : "<div></div>"; // if there's no content, provide an empty div to prevent error
        content = this.parser.parseWithInstructions(
            content,
            () => true,
            this.processingInstructions
        );
        return content;
    }

    render() {
        return (
            <div style={this.props.style} className={this.props.className}>
                {this.processContent(this.props.content)}
            </div>
        );
    }
}
