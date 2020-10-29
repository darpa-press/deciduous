import React from "react";
import api from "common/api";
import transition from "styled-transition-group";

import { PieceViewDumb } from "Components/PieceDumb/PieceDumb";
import Loading from "Components/Loading/Loading";
import { Page, PageScroll } from "Components/Page/Page";
import ActionBar from "Components/ActionBar/ActionBar";
import CardCatalogue from "Components/CardCatalogue/CardCatalogue";

const transitionSpeed = 250;

const ShowCard = transition.div`
    &:enter {
        opacity: 0.01;
    }
    &:enter-active {
        opacity: 1;
        transition: opacity ${transitionSpeed}ms ease;
    }
    &:exit {
        opacity: 1;
    }
    &:exit-active {
        opacity: 0.01;
        transition: opacity ${transitionSpeed}ms ease;
    }
    z-index: 2;
`;

export default class PieceView extends React.Component {
    constructor(props) {
        super(props);
        this.emptyPiece = {
            title: "",
            stub: false
        };
        this.state = {
            piece: this.emptyPiece,
            children: [],
            showingCard: false,
            loaded: false,
            loading: false
        };
    }

    async getPiece(pieceInput) {
        this.setState({
            showingCard: pieceInput.indexOf("c") >= 0
        });

        const piece = pieceInput.replace(/\D/, "");

        this.setState({ loading: true, children: [] });

        if (sessionStorage[`piece-${piece}`]) {
            this.setState({
                piece: JSON.parse(sessionStorage[`piece-${piece}`]),
                loaded: true,
                loading: false
            });
        }

        // regrab it
        const data = await api.getPiece(piece);
        this.setState({
            piece: data,
            editing: false,
            loaded: true,
            loading: false
        });
        sessionStorage[`piece-${piece}`] = JSON.stringify(data);

        this.props.updateTitle(data.title);

        // grab the kids
        this.getChildren(data["_id"]);
    }

    async getChildren(id) {
        const children = await api.getPieceChildren(id);
        this.setState({
            children: children ? children : []
        });
    }

    componentDidMount() {
        this.props.updateTitle("⋅");
        this.getPiece(this.props.piece);
    }

    componentWillReceiveProps(newProps) {
        if (newProps.piece !== this.props.piece) {
            this.setState({ loaded: false });
            this.getPiece(newProps.piece);
        }
    }

    render() {
        if (!this.state.loaded || this.state.loading) {
            return <Loading />;
        }
        return (
            <Page>
                <PageScroll>
                    <ShowCard
                        in={
                            typeof this.props.showCard !== "undefined" &&
                            this.props.showCard === true
                        }
                        mountOnEnter={true}
                        unmountOnExit={true}
                        timeout={transitionSpeed}
                    >
                        <CardCatalogue {...this.props} {...this.state.piece} />
                    </ShowCard>
                    <PieceViewDumb
                        isInList={false}
                        {...this.props}
                        {...this.state.piece}
                        children={this.state.children}
                    />
                </PageScroll>
                <ActionBar
                    cardLink={`${this.state.piece.page}${
                        this.state.showingCard ? "" : "c"
                    }`}
                    children={this.state.children}
                    createLink={this.props.createLink}
                    editLink={this.props.createLink(
                        `edit-${this.state.piece.page}`
                    )}
                    loggedIn={this.props.loggedIn}
                    parent={this.state.piece.parent}
                    persons={this.state.piece.persons}
                />
            </Page>
        );
    }
}
