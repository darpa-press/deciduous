import React from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";

const LoginLinkItem = styled(Link)`
    background: rgba(0, 0, 0, 0.025);
    border-radius: 2px;
    display: block;
    height: 16px;
    outline: none !important;
    position: fixed;
    right: 1rem;
    top: 1rem;
    transition: all 0.2s ease;
    width: 16px;

    @media (min-width: 768px) {
        &:hover {
            background: rgba(0, 0, 0, 0.1);
        }
    }
`;

const LoginLinkItemLoggedIn = styled(LoginLinkItem)`
    background: rgba(0, 200, 130, 0.3333);
    @media (min-width: 768px) {
        &:hover {
            background: rgba(0, 200, 130, 0.6);
        }
    }
`;

export default class LoginLink extends React.Component {
    render() {
        const ItemToRender = this.props.loggedIn
            ? LoginLinkItemLoggedIn
            : LoginLinkItem;
        return <ItemToRender to="/login" />;
    }
}
