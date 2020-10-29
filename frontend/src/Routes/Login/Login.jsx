import React from "react";
import { withRouter } from "react-router-dom";
import styled from "styled-components";

import Helmet from "Components/Helmet/Helmet";

const LoginContainer = styled.div`
    font-size: 0.8rem;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
`;

const LoginForm = styled.form`
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 320px;
`;

const LoginSubmit = styled.button`
    align-items: center;
    display: flex;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    justify-content: center;
    padding: 0.4rem 0.28rem;
    text-align: left;
    width: 4rem;
`;

const LoginInput = styled.input`
    margin-bottom: 0.5rem;
    padding: 0.4rem 0.28rem;
`;

const BackLinkSpan = styled.span`
    color: rgba(0, 0, 0, 0.5);
    display: inline-block;
    position: fixed;
    top: 16px;
    left: 16px;
`;

const BackLink = ({ goBack }) => (
    <BackLinkSpan onClick={goBack}>&lsaquo; Go back</BackLinkSpan>
);

class Login extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            name: "",
            password: ""
        };
    }
    goBack() {
        this.props.history.go(-1);
    }

    render() {
        if (this.props.loggedIn) {
            return (
                <LoginContainer>
                    <Helmet titles={["Logged in"]} />
                    <LoginForm>
                        <BackLink goBack={this.goBack.bind(this)} />
                        <div style={{ paddingBottom: "1rem" }}>
                            Already logged in.
                        </div>
                        <LoginSubmit
                            onClick={e => {
                                e.preventDefault();
                                this.props.handleLogout();
                            }}
                        >
                            Log out
                        </LoginSubmit>
                    </LoginForm>
                </LoginContainer>
            );
        } else {
            return (
                <LoginContainer>
                    <Helmet titles={["Log in"]} />
                    <BackLink goBack={this.goBack.bind(this)} />
                    <LoginForm>
                        <LoginInput
                            value={this.state.name}
                            onChange={e =>
                                this.setState({ name: e.target.value })
                            }
                            type="text"
                            placeholder="Username"
                            autoFocus
                        />
                        <LoginInput
                            value={this.state.password}
                            onChange={e =>
                                this.setState({ password: e.target.value })
                            }
                            type="password"
                            placeholder="password"
                        />
                        <LoginSubmit
                            onClick={e => {
                                e.preventDefault();
                                this.props.handleLogin(this.state, () => {
                                    this.props.history.go(-1);
                                });
                            }}
                            type="submit"
                        >
                            Log in
                        </LoginSubmit>
                    </LoginForm>
                </LoginContainer>
            );
        }
    }
}

export default withRouter(Login);
