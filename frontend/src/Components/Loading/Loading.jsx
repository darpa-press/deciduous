import React from "react";

import loadingSpinner from "./Spiral.svg";
import loadingSpinner2 from "./Spiral2.svg";

import ActionBar from "Components/ActionBar/ActionBar";
import { Page, PageScroll, PageLoading } from "Components/Page/Page";

import transition from "styled-transition-group";

const transitionSpeed = 3000;

const FadeImg = transition.img`
    &:enter,
    &:appear {
        opacity:0.01
    }
    &:enter-active,
    &:appear-active {
        opacity: 1;
        transition: all ${transitionSpeed}ms ease;
    }
`;

export default flip => {
    return (
        <Page>
            <PageScroll>
                <PageLoading>
                    <FadeImg
                        in={true}
                        timeout={transitionSpeed}
                        appear={true}
                        alt="Loading"
                        src={flip ? loadingSpinner2 : loadingSpinner}
                    />
                </PageLoading>
            </PageScroll>
            <ActionBar />
        </Page>
    );
};
