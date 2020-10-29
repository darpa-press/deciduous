import React from "react";
import styled from "styled-components";
import ActionBar from "Components/ActionBar/ActionBar";

import IndexAlpha from "./IndexAlpha/IndexAlpha";
import IndexTree from "./IndexTree/IndexTree";

import iconAlpha from "common/img/icon-alpha.svg";
import iconTree from "common/img/icon-tree.svg";
import { Link } from "react-router-dom";
import { Page, PageScroll, PageInside } from "Components/Page/Page";

const IndexTypes = styled(PageInside)`
    display: flex;
    align-items: center;
    justify-content: center;
    padding-bottom: 2rem;
    user-select: none;
`;

const IndexType = styled(Link)`
    margin: 0 0.5rem;
    opacity: 0.5;
    cursor: pointer;
`;

const IndexTypeChosen = styled(IndexType)`
    opacity: 1;
`;

const IndexTypeImage = styled.img`
    height: 24px;
    width: auto;
`;

export default class Index extends React.Component {
    constructor(props) {
        super(props);
        this.indexTypes = ["tree", "alpha"];
        this.indexImages = {
            alpha: iconAlpha,
            tree: iconTree
        };
    }

    componentDidMount() {
        this.props.updateTitle(`Index`);
    }

    render() {
        return (
            <Page>
                <PageScroll>
                    <IndexTypes>
                        {this.indexTypes.map(type => {
                            const Container = this.props.selected
                                ? IndexTypeChosen
                                : IndexType;
                            return (
                                <Container
                                    key={type}
                                    to={this.props.createLink(
                                        type === "tree" ? "index" : "index-a"
                                    )}
                                >
                                    <IndexTypeImage
                                        alt={type}
                                        src={this.indexImages[type]}
                                    />
                                </Container>
                            );
                        })}
                    </IndexTypes>
                    {this.props.selected === "tree" && (
                        <IndexTree {...this.props} />
                    )}
                    {this.props.selected === "alpha" && (
                        <IndexAlpha {...this.props} />
                    )}
                </PageScroll>
                <ActionBar {...this.props} />
            </Page>
        );
    }
}
