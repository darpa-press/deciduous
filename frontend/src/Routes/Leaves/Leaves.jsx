import React from "react";

import Helmet from "Components/Helmet/Helmet";
import Graph from "Pages/Graph/GraphLoader";

import Index from "Pages/Index/IndexPiece/IndexPiece";
import IndexPerson from "Pages/Index/IndexPerson/IndexPerson";
import IndexWord from "Pages/Index/IndexWord/IndexWord";

import AllPieces from "Pages/AllPieces/AllPieces";

import Piece from "Pages/Single/Piece/Piece";
import Person from "Pages/Single/Person/Person";
import Word from "Pages/Single/Word/Word";

import PieceEdit from "Pages/Edit/PieceEdit/PieceEditLoader";
import PersonEdit from "Pages/Edit/PersonEdit/PersonEditLoader";

import NotFound from "Pages/NotFound/NotFound";
import { PageContainer } from "Components/Page/Page";

import { Route, Switch } from "react-router-dom";

/* TODO: is there a problem with using createlink in the render ?? should be added to state maybe
const createLinkFunction = (pathArray, newItem) => {
    const newPathArray = pathArray.slice(0);
    newPathArray[index] = newItem;
    const newPathUrl = `/${newPathArray.join("/")}`;
    return newPathUrl;
};
*/

export default class Leaves extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            pathArray: [],
            noOfPages: 0,
            titles: this.props.location.pathname
                .split("/")
                .slice(1)
                .map(path => "⋅")
        };
    }

    componentWillReceiveProps(newProps) {
        if (this.props.location.pathname !== newProps.location.pathname) {
            this.breakDownPaths(newProps.location.pathname);
        }
    }

    componentDidMount() {
        this.breakDownPaths(this.props.location.pathname);
    }

    breakDownPaths(pathname) {
        let pathArray = pathname.split("/").slice(1);
        pathArray = window.innerWidth > 767 ? pathArray : pathArray.slice(0, 1); // only show one piece on mobile
        this.setState({
            pathArray: pathArray,
            noOfPages: pathArray.length
        });
    }

    updateTitle(index, title) {
        let titles = this.state.titles;
        titles[index] = title;
        this.setState({ titles: titles });
    }

    render() {
        return (
            <PageContainer>
                <Helmet titles={this.state.titles} />
                {this.state.pathArray.map((pieceId, index) => {
                    const thisLocation = {
                        pathname: `/${pieceId}`
                    };

                    const createLink = (newItem, contextual) => {
                        const indexModified = contextual
                            ? index === this.state.pathArray.length - 1
                                ? index - 1 >= 0 // for single page setups
                                    ? index - 1
                                    : 0
                                : index + 1
                            : index;
                        const newPathArray = this.state.pathArray.slice(0);
                        newPathArray[indexModified] = newItem;
                        const newPathUrl = `/${newPathArray.join("/")}`;
                        return newPathUrl;
                    };

                    const routeOptions = {
                        ...this.props,
                        key: index,
                        createLink: createLink,
                        pieceIndex: index,
                        piece: pieceId,
                        pathArray: this.state.pathArray,
                        match: this.props.match,
                        noOfPages: this.state.noOfPages,
                        updateTitle: title => {
                            this.updateTitle(index, title);
                        }
                    };

                    return (
                        <Switch key={index} location={thisLocation}>
                            <Route
                                path={`/graph`}
                                render={props => (
                                    <Graph {...routeOptions} {...props} />
                                )}
                                exact
                            />

                            <Route
                                path={`/index`}
                                render={props => (
                                    <Index
                                        selected="tree"
                                        {...routeOptions}
                                        {...props}
                                    />
                                )}
                                exact
                            />

                            <Route
                                path={`/index-a`}
                                render={props => (
                                    <Index
                                        selected="alpha"
                                        {...routeOptions}
                                        {...props}
                                    />
                                )}
                                exact
                            />

                            <Route
                                path={`/person`}
                                render={props => (
                                    <IndexPerson {...routeOptions} {...props} />
                                )}
                                exact
                            />
                            <Route
                                path={`/word`}
                                render={props => (
                                    <IndexWord {...routeOptions} {...props} />
                                )}
                                exact
                            />
                            <Route
                                path={`/all`}
                                render={props => (
                                    <AllPieces {...routeOptions} {...props} />
                                )}
                                exact
                            />

                            <Route
                                path={`/:person(p-.*)`}
                                render={props => (
                                    <Person {...routeOptions} {...props} />
                                )}
                            />
                            <Route
                                path={`/:word(w-.*)`}
                                render={props => (
                                    <Word {...routeOptions} {...props} />
                                )}
                            />

                            <Route
                                path={`/:id([0-9]*)`}
                                render={props => (
                                    <Piece {...routeOptions} {...props} />
                                )}
                            />
                            <Route
                                path={`/:id([0-9]*c)`}
                                render={props => (
                                    <Piece
                                        {...routeOptions}
                                        {...props}
                                        showCard={true}
                                    />
                                )}
                            />

                            {this.props.loggedIn && [
                                <Route
                                    key={"we"}
                                    path={`/:id(edit-[0-9]*)`}
                                    render={props => (
                                        <PieceEdit
                                            {...routeOptions}
                                            {...props}
                                        />
                                    )}
                                    exact
                                />,
                                <Route
                                    key={"pe"}
                                    path={`/:person(edit-person-.*)`}
                                    render={props => (
                                        <PersonEdit
                                            {...routeOptions}
                                            {...props}
                                        />
                                    )}
                                    exact
                                />,
                                <Route
                                    key={"wn"}
                                    path={`/new`}
                                    render={props => (
                                        <PieceEdit
                                            {...routeOptions}
                                            {...props}
                                            new={true}
                                        />
                                    )}
                                    exact
                                />,
                                <Route
                                    key={"pn"}
                                    path={`/new-person`}
                                    render={props => (
                                        <PersonEdit
                                            {...routeOptions}
                                            {...props}
                                            new={true}
                                        />
                                    )}
                                    exact
                                />
                            ]}

                            <Route render={props => <NotFound {...props} />} />
                        </Switch>
                    );
                })}
            </PageContainer>
        );
    }
}
