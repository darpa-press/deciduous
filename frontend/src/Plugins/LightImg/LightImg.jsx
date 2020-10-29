import React from "react";
import Image from "react-graceful-image";
import styled from "styled-components";
import transition from "styled-transition-group";

const LightboxContainer = styled.div`
    margin-bottom: 2rem;
    transition: box-shadow 0.2s ease;
    img {
        cursor: pointer;
        margin-bottom: 0;
        vertical-align: bottom;
    }

    @media screen and (min-width: 768px) {
        &:hover {
            background: inherit !important;
        }
    }
`;

const transitionSpeed = 250;

const LightboxUp = transition.div`
    align-items: center;
    background: rgba(255, 255, 255, 0.999);
    display: flex;
    height: 100%;
    justify-content: center;
    left: 0;
    position: fixed;
    top: 0;
    width: 100%;
    z-index: 100;

    img {
        height: auto;
        margin-bottom: 0 !important;
        max-height: 95vh;
        max-width: 95vw;
        width: auto;
    }

    &:enter {
        opacity: 0.01;
    }
    &:enter-active {
        opacity: 1;
        transition: opacity ${transitionSpeed}ms ease-in;
    }
    &:exit {
        opacity: 1;
    }
    &:exit-active {
        opacity: 0.01;
        transition: opacity ${transitionSpeed - 100}ms ease-in;
    }
`;

export default class LightImg extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            show: false
        };
    }

    toggleLightbox() {
        this.setState({
            show: !this.state.show
        });
    }

    render() {
        return (
            <LightboxContainer>
                <div onClick={this.toggleLightbox.bind(this)}>
                    <Image
                        noLazyLoad={true}
                        alt=""
                        placeholderColor={"rgba(0,0,0,0.02)"}
                        {...this.props}
                    />
                </div>
                <LightboxUp
                    in={this.state.show}
                    timeout={transitionSpeed}
                    unmountOnExit
                    onClick={this.toggleLightbox.bind(this)}
                    style={{ backgroundColor: this.props.bg || "" }}
                >
                    <img alt="" key={this.props.src} src={this.props.src} />
                </LightboxUp>
            </LightboxContainer>
        );
    }
}
