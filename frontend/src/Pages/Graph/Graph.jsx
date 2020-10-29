import React from "react";
import api from "common/api";

import Graph from "react-graph-vis";
import ActionBar from "Components/ActionBar/ActionBar";
import Loading from "Components/Loading/Loading";
import { Page, PageInside, PageScroll } from "Components/Page/Page";

import { Redirect } from "react-router-dom";
import styled from "styled-components";

const PageInsideGraph = styled(PageInside)`
    padding: 0;
`;

export default class GraphPage extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            loaded: false,
            redirect: false,
            graph: {
                nodes: [],
                edges: []
            }
        };

        this.options = {
            autoResize: true,
            layout: {
                hierarchical: false
            },
            edges: {
                color: {
                    // color: graphColours.black,
                    inherit: false
                },
                type: "dynamic",
                width: 1
            },
            nodes: {
                shape: "dot",
                size: 12,
                font: {
                    //size: 32,
                    // color: graphColours.black,
                    face: '"FigginsItalic"'
                },
                borderWidth: 1
            },
            physics: {
                barnesHut: {
                    avoidOverlap: 0.2,
                    gravitationalConstant: -20000
                },
                minVelocity: 0.75
            }
        };

        this.events = {
            select: event => {
                // var { nodes, edges } = event;
                const selectedNodeLink = this.state.graph.nodes.find(
                    node => node.id === event.nodes[0]
                ).link;
                this.setState({
                    redirect: this.props.createLink(selectedNodeLink)
                });
            }
        };
    }

    onResize() {}

    componentDidMount() {
        this.props.updateTitle(`Graph`);
        this.setState({ redirect: false });
        this.getGraph();
    }

    componentWillUnmount() {}

    async getGraph() {
        const graph = await api.getGraph();
        this.setState({
            loaded: true,
            graph: graph
        });
    }

    render() {
        if (this.state.redirect) {
            return <Redirect to={this.state.redirect} />;
        }

        if (!this.state.loaded) {
            return <Loading />;
        }
        return (
            <Page>
                <PageScroll>
                    <PageInsideGraph>
                        <Graph
                            graph={this.state.graph}
                            options={this.options}
                            events={this.events}
                            style={{ height: "100vh", width: "100%" }}
                        />
                    </PageInsideGraph>
                </PageScroll>
                <ActionBar createLink={this.props.createLink} loggedIn={true} />
            </Page>
        );
    }
}
