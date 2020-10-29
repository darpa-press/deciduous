import React from "react";
import api from "common/api";
import ActionBar from "Components/ActionBar/ActionBar";
import Loading from "Components/Loading/Loading";

import { PieceViewDumb } from "Components/PieceDumb/PieceDumb";
import { Page, PageScroll } from "Components/Page/Page";

export default class Person extends React.Component {
    noOfPieces = 300;

    constructor(props) {
        super(props);
        this.state = {
            loaded: false,
            pieces: {}
        };
    }

    async getPieces() {
        const pieces = await api.getXPieces(this.noOfPieces);
        this.setState({
            loaded: true,
            pieces: pieces
        });
    }

    componentDidMount() {
        this.getPieces();
        this.props.updateTitle(`Last ${this.noOfPieces}`);
    }

    render() {
        return !this.state.loaded ? (
            <Loading />
        ) : (
            <Page>
                <PageScroll>
                    {this.state.pieces && this.state.pieces.length > 0 && (
                        <React.Fragment>
                            {this.state.pieces.map(piece => (
                                <PieceViewDumb
                                    key={piece.slug}
                                    {...piece}
                                    isInList={true}
                                    createLink={this.props.createLink}
                                />
                            ))}
                        </React.Fragment>
                    )}
                </PageScroll>
                <ActionBar {...this.props} />
            </Page>
        );
    }
}
