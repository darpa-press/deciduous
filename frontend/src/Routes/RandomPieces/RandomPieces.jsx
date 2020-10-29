import React from "react";
import { Redirect } from "react-router-dom";
import shuffleArray from "shuffle-array";
import api from "common/api";

import Loading from "Components/Loading/Loading";
import { PageContainer } from "Components/Page/Page";

export default class RandomPieces extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            pieces: [],
            loaded: false
        };
    }

    async getPieces() {
        const pieces = await api.getAllPieces();
        const shuffled = shuffleArray(pieces)
            .slice(0, 2)
            .map(piece => piece.page);
        this.setState({
            pieces: shuffled,
            loaded: true
        });
    }

    componentDidMount() {
        this.getPieces();
    }

    render() {
        return !this.state.loaded ? (
            <PageContainer>
                <Loading />
                <Loading flip={true} />
            </PageContainer>
        ) : (
            <Redirect to={`/${this.state.pieces.join("/")}`} />
        );
    }
}
