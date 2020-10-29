import React, { Component } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import cookies from "browser-cookies";
import Helmet from "react-helmet";

import LoginLink from "Components/LoginLink/LoginLink";
import { SearchScreen, SearchIcon } from "Pages/Search/Search";

import api from "common/api";

import Routes from "./routes";

import "normalize-css";
import "common/css/global.css";
import "common/fonts/fonts.css";

export default class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            loggedIn: !!cookies.get("apiToken"),
            tree: [],
            searching: false
        };
    }

    async componentDidMount() {
        const tree = await api.getTree();
        sessionStorage.index = JSON.stringify(tree);
        this.setState({ tree: tree });
    }

    async handleLogin(details, redirectFunction) {
        // login code here
        const login = await api.login(details);
        if (login) {
            cookies.set("apiToken", login.token, { expires: 7 });
            this.setState({ loggedIn: true });
            if (redirectFunction) {
                redirectFunction();
            } else {
                window.location.replace("/index/index");
            }
        }
    }

    async handleLogout() {
        // remove cookie and turn off loggedIn
        cookies.erase("apiToken");
        this.setState({ loggedIn: false });
    }

    render() {
        return (
            <Router>
                <div className="app">
                    <Helmet>
                        <title>Deciduous</title>
                    </Helmet>
                    <Routes
                        {...this.props}
                        loggedIn={this.state.loggedIn}
                        handleLogin={this.handleLogin.bind(this)}
                        handleLogout={this.handleLogout.bind(this)}
                    />
                    <LoginLink loggedIn={this.state.loggedIn} />

                    {this.state.searching ? (
                        <SearchScreen
                            handleDismiss={e =>
                                this.setState({ searching: false })
                            }
                        />
                    ) : (
                        <SearchIcon
                            onClick={e => {
                                this.setState({ searching: true });
                            }}
                        />
                    )}
                </div>
            </Router>
        );
    }
}
