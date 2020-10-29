// import React from 'react'
import styled from "styled-components";

export const PageContainer = styled.div`
    display: flex;
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
`;

export const Page = styled.div`
    border-right: 1px solid #e8e8e8;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    flex: 1 1 50%;
    height: 100%;
    overflow: hidden;
    position: relative;
    transition: all 0.5s ease;
    &:last-child {
        border-right: 0;
    }

    @media (max-width: 767px) {
        display: none;
        &:first-child {
            display: flex;
        }
    }
`;

export const PageLoading = styled.div`
    align-items: center;
    display: flex;
    height: 100%;
    justify-content: center;
`;

export const PageInside = styled.div`
    padding: 1rem 2rem 3rem;
    @media (max-width: 767px) {
        padding: 0.75rem;
    }
`;

export const PageScroll = styled.div`
    -webkit-overflow-scrolling: touch;
    flex: 0 0 calc(100vh - 2.5rem);
    overflow-y: auto;

    @media (max-width: 767px) {
        left: 0;
        position: absolute;
        top: 0;
        width: 100%;
        height: 100%;
        padding-bottom: 3rem;
    }
`;
