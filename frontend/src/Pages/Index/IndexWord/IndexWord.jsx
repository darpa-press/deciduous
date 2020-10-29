import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import api from "common/api";

import { Page, PageScroll, PageInside } from "Components/Page/Page";
import ActionBar from "Components/ActionBar/ActionBar";
import Loading from "Components/Loading/Loading";

const WordsList = styled.div`
    font-family: FigginsItalic;
    user-select: none;
`;

const WordItem = styled.div`
    display: flex;
    flex-direction: column;
`;

const WordName = styled.div`
    align-items: center;
    display: flex;
    white-space: nowrap;
    span {
        opacity: 0.5;
        margin-right: 0.5em;
    }
    span:last-child {
        opacity: 1;
    }
`;

const WordItemChildren = styled.div`
    /*padding-left: 1.5rem; */
`;

const formatWord = word => {
    let formattedWord = word.replace(/_/g, " ");
    return formattedWord.charAt(0).toUpperCase() + formattedWord.slice(1);
};

class WordItemContainer extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const { word, id, children, createLink } = this.props;
        const formattedWord = formatWord(word);
        const currentWord = (
            <>
                {this.props.parentWord}
                <span>{formattedWord}</span>
            </>
        );
        return (
            <WordItem>
                <WordName>
                    <Link to={createLink(`w-${id}`)}>{currentWord}</Link>
                </WordName>
                <WordItemChildren>
                    {children &&
                        children.length &&
                        children.map(child => (
                            <WordItemContainer
                                {...child}
                                parentWord={currentWord}
                                createLink={createLink}
                            />
                        ))}
                </WordItemChildren>
            </WordItem>
        );
    }
}

export default class IndexWord extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            words: [],
            loaded: false
        };
    }

    async getAllWords() {
        this.setState({ loaded: false });
        const words = await api.getAllExistingWords();
        this.setState({
            words: words,
            loaded: true
        });
    }

    componentDidMount() {
        this.props.updateTitle(`Words`);
        this.getAllWords();
    }

    render() {
        const { loaded, words } = this.state;

        if (!this.state.loaded) {
            return <Loading />;
        }

        return (
            <Page>
                <PageScroll>
                    <PageInside>
                        {loaded && (
                            <WordsList>
                                {words.map(word => (
                                    <WordItemContainer
                                        {...word}
                                        parentWord={""}
                                        createLink={this.props.createLink}
                                    />
                                ))}
                            </WordsList>
                        )}
                    </PageInside>
                </PageScroll>
                <ActionBar {...this.props} />
            </Page>
        );
    }
}
