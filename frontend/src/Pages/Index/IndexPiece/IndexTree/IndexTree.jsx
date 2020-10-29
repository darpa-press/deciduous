import React from "react";
import { Link } from "react-router-dom";
import api from "common/api";
import Loading from "Components/Loading/Loading";
import { PageInside } from "Components/Page/Page";
import styled from "styled-components";

const IndexItemContainer = styled.div`
    margin: 0.25rem 0;
    font-family: "FigginsItalic", -apple-system, BlinkMacSystemFont, sans-serif;
    user-select: none;
`;

const IndexChildren = styled.div`
    padding-left: 1.5rem;
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
    border-left: 0.5px solid #e8e8e8;
    @media screen and (max-width: 767px) {
        font-size: 1rem;
        padding-left: 0.5rem;
        border-left: 0;
    }
`;

const IndexNumber = styled.div`
    float: right;
    font-family: "Figgins", -apple-system, BlinkMacSystemFont, sans-serif;
    @media screen and (max-width: 767px) {
        display: none;
    }
`;

const IndexLinkContainer = styled.div`
    a {
        display: block;
    }

    @media screen and (max-width: 767px) {
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }

    @media screen and (min-width: 768px) {
        a:hover {
            opacity: 0.5;
        }
    }
`;

const IndexLink = ({ title, page, stub, link, loggedIn }) => {
    return (
        <IndexLinkContainer className={stub ? "quiet" : ""}>
            {!stub || loggedIn ? (
                <Link to={link} style={{ opacity: stub ? 0.5 : 1 }}>
                    {title}
                    <IndexNumber>{page}</IndexNumber>
                </Link>
            ) : (
                <span>
                    {title}
                    <IndexNumber>{page}</IndexNumber>
                </span>
            )}
        </IndexLinkContainer>
    );
};

const IndexItem = ({ title, page, stub, children, createLink, loggedIn }) => {
    return (
        <IndexItemContainer>
            <IndexLink
                title={title}
                stub={stub}
                page={page}
                link={createLink(page)}
                loggedIn={loggedIn}
            />
            {children && children.length > 0 && (
                <IndexChildren>
                    {children.map((child, index) => {
                        return (
                            <IndexItem
                                key={child.page}
                                {...child}
                                loggedIn={loggedIn}
                                page={child.page}
                                createLink={createLink}
                            />
                        );
                    })}
                </IndexChildren>
            )}
        </IndexItemContainer>
    );
};

const IndexTreeDumb = ({ pieces, props }) => {
    return pieces.map((piece, index) => (
        <IndexItem key={index} {...props} {...piece} />
    ));
};

export default class IndexTree extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loaded: false,
            pieces: []
        };
    }

    componentDidMount() {
        this.getTree();
    }

    async getTree() {
        if (sessionStorage.index) {
            this.setState({
                loaded: true,
                pieces: JSON.parse(sessionStorage.index)
            });
        }
        const tree = await api.getTree();
        this.setState({
            loaded: true,
            pieces: tree
        });
        sessionStorage.index = JSON.stringify(tree);
    }

    render() {
        return !this.state.loaded ? (
            <Loading />
        ) : (
            <PageInside>
                <IndexTreeDumb pieces={this.state.pieces} props={this.props} />
            </PageInside>
        );
    }
}
