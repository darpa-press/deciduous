import React from "react";
import { Link } from "react-router-dom";
import fontColorContrast from "font-color-contrast";

import ContentParser from "Components/Parser/Parser";
import { PageInside } from "Components/Page/Page";

import styled from "styled-components";

const PieceDiv = styled.div`
    min-height: calc(100vh - 2.5rem);

    p {
        margin-left: 0;
        max-width: 25rem;
    }

    .indents p {
        margin: 0;
        max-width: 30rem;
        text-indent: 2rem;
    }

    &.piece--text-light a {
        color: #ffffff;
        text-decoration-color: rgba(255, 255, 255, 0.2);
        &:hover {
            text-decoration-color: white;
        }
    }

    + div {
        border-top: 1px solid #e8e8e8;
    }
`;

const PieceTitleDiv = styled.h1`
    font-family: "FigginsItalic", -apple-system, BlinkMacSystemFont, sans-serif;
    margin: 0 1rem 2rem;
    padding-top: 1rem;
    text-align: center;
`;

const PieceContentDiv = styled(PageInside)`
    align-items: center;
    display: flex;
    justify-content: center;
    min-height: calc(100vh - 8rem);
    /* position: relative; */

    > div > * {
        margin-left: auto;
        margin-right: auto;
    }

    a {
        text-decoration: underline;
        text-decoration-color: rgba(0, 0, 0, 0.1);
    }

    iframe {
        max-width: 100%;
    }

    img,
    video {
        height: auto;
        margin-bottom: 1.5rem;
        max-height: 85vh;
        max-width: 100%;
        width: auto;
        + attr {
            display: block;
            font-style: italic;
            margin-bottom: 2.5rem;
            margin-top: -1.5rem;
        }
    }

    video {
        height: auto;
        width: 100%;
    }

    li {
        margin-bottom: 0.5rem;
    }

    @media screen and (min-width: 768px) {
        a:hover {
            cursor: pointer;
            text-decoration-color: black;
            transition: text-decoration-color 1s ease;
        }
    }

    .small-images img {
        border-radius: 1px;
        height: 1em;
        margin-bottom: 0;
        margin-left: 2px;
        vertical-align: -0.15em;
        width: auto;
    }

    .iframe-container {
        height: 0;
        margin-bottom: 1.5rem;
        overflow: hidden;
        padding-bottom: 56.25%;
        position: relative;
    }

    .iframe-container iframe {
        height: 100%;
        left: 0;
        position: absolute;
        top: 0;
        width: 100%;
    }

    .full-image-overlay {
        background-size: cover;
        height: 100vh;
        left: 0;
        pointer-events: none;
        position: absolute;
        top: 0;
        width: 100%;
    }
`;

export const PieceViewDumb = ({
    background,
    children,
    content,
    createLink,
    fullWidth,
    loggedIn,
    noOfPages,
    isInList,
    page,
    parent,
    persons,
    title
}) => {
    let textColor =
        background && background !== "" ? fontColorContrast(background) : false;

    textColor = textColor === "#000000" ? "#333" : textColor; // monkey patch the contrast result

    return (
        <PieceDiv
            className={`${
                textColor === "#ffffff"
                    ? "piece--text-light"
                    : "piece--text-dark"
            }`}
            style={{
                backgroundColor: background || null,
                color: textColor || null
            }}
        >
            <PieceViewIndex
                page={page}
                title={title}
                link={createLink(isInList ? page : "index")}
            />

            <PieceContentDiv className={`${fullWidth ? "piece__full" : ""}`}>
                <ContentParser content={content} createLink={createLink} />
            </PieceContentDiv>
        </PieceDiv>
    );
};

export class PieceViewIndex extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hover: false
        };
    }

    render() {
        return (
            <PieceTitleDiv>
                <div>
                    <Link
                        to={this.props.link}
                        onMouseOver={() => this.setState({ hover: true })}
                        onMouseOut={() => this.setState({ hover: false })}
                    >
                        {this.state.hover ? this.props.title : this.props.page}
                    </Link>
                </div>
            </PieceTitleDiv>
        );
    }
}
