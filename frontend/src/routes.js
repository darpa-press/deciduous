import React from "react";
import { Route, Switch, Redirect } from "react-router-dom";

import Leaves from "Routes/Leaves/Leaves";
import Login from "Routes/Login/Login";
import RandomPieces from "Routes/RandomPieces/RandomPieces";

export default ({
    types,
    handleLogin,
    handleLogout,
    loggedIn,
    location,
    match
}) => {
    return (
        <div>
            <Switch location={location}>
                {/* 1. Login */}
                <Route
                    exact
                    path={`/login`}
                    render={props => (
                        <Login
                            {...props}
                            loggedIn={loggedIn}
                            handleLogin={handleLogin}
                            handleLogout={handleLogout}
                        />
                    )}
                />
                {/* 2. Homepage */}
                <Route
                    exact
                    path={`/`}
                    render={props => <Redirect to="/2/125" />}
                />

                {/* 3. Random pieces */}
                <Route
                    exact
                    path={`/random`}
                    render={props => (
                        <RandomPieces {...props} loggedIn={loggedIn} />
                    )}
                />

                {/* 4. Regular handler */}
                <Route
                    exact={false}
                    path={`/`}
                    render={props => <Leaves {...props} loggedIn={loggedIn} />}
                />
            </Switch>
        </div>
    );
};
