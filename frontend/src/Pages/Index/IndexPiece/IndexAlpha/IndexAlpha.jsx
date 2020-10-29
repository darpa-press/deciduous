import React from "react";
import styled from "styled-components";
import api from "common/api";
import { Link } from "react-router-dom";
import Loading from "Components/Loading/Loading";
import { PageInside } from "Components/Page/Page";

const IndexAlphaContainer = styled.div`
    display: flex;
    margin-bottom: 1rem;
    font-family: "FigginsItalic", -apple-system, BlinkMacSystemFont, sans-serif;
    user-select: none;
`;

const IndexAlphaLetter = styled.div`
    flex: 0 0 3rem;
    font-family: "Figgins", -apple-system, BlinkMacSystemFont, sans-serif;
`;

const IndexAlphaPiece = styled.div`
    margin-bottom: 0.333rem;
    a {
        display: flex;
        align-items: center;
    }
`;

const ErrorsDiv = styled.div`
    margin-left: 0.25rem;
    display: flex;
    font-family: sans-serif;
    color: red;
    font-size: 0.75rem;
`;

const ErrorItem = styled.div`
    margin-right: 0.25rem;
`;

const Errors = ({ piece }) => {
    const keysToCheck = ["readme", "word", "persons", "lovers", "hasLink"];
    const checkPiece = (piece, key) =>
        !piece.hasOwnProperty(key) ||
        piece[key] === "" ||
        piece[key] === null ||
        piece[key] === false ||
        !piece[key].length === 0;
    return (
        <ErrorsDiv>
            {keysToCheck.map(
                key =>
                    checkPiece(piece, key) && (
                        <ErrorItem key={key}>{key}</ErrorItem>
                    )
            )}
        </ErrorsDiv>
    );
};

export default class IndexAlpha extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loaded: false,
            pieces: []
        };
    }

    componentDidMount() {
        this.getPieces();
    }

    async getPieces() {
        if (sessionStorage.pieces) {
            this.setState({
                loaded: true,
                pieces: JSON.parse(sessionStorage.pieces)
            });
        }
        const pieces = await api.getAllPieces();
        const sortedPieces = this.sortPieces(pieces);
        this.setState({
            loaded: true,
            pieces: sortedPieces
        });
        sessionStorage.pieces = JSON.stringify(sortedPieces);
    }

    sortPieces(pieces) {
        const sortedPieces = {};
        for (let i = 0; i < pieces.length; i++) {
            const letter = pieces[i].title.substr(0, 1).toUpperCase();
            if (!sortedPieces[letter]) {
                sortedPieces[letter] = [pieces[i]];
            } else {
                sortedPieces[letter].push(pieces[i]);
            }
        }
        return sortedPieces;
    }

    render() {
        if (!this.state.loaded) {
            return <Loading />;
        }

        return (
            <PageInside>
                <div>
                    {Object.keys(this.state.pieces).map(letter => (
                        <IndexAlphaContainer key={letter}>
                            <IndexAlphaLetter>{letter}</IndexAlphaLetter>
                            <div>
                                {this.state.pieces[letter].map(piece => (
                                    <IndexAlphaPiece key={piece["_id"]}>
                                        <Link
                                            to={this.props.createLink(
                                                piece.page,
                                                true
                                            )}
                                        >
                                            {piece.title}
                                            {this.props.loggedIn ? (
                                                <Errors piece={piece} />
                                            ) : null}
                                        </Link>
                                    </IndexAlphaPiece>
                                ))}
                            </div>
                        </IndexAlphaContainer>
                    ))}
                </div>
            </PageInside>
        );
    }
}
