import React from "react";
import api from "common/api";

import ActionBar from "Components/ActionBar/ActionBar";
import Loading from "Components/Loading/Loading";
import { PieceViewDumb } from "Components/PieceDumb/PieceDumb";
import { Page, PageScroll, PageInside } from "Components/Page/Page";

import styled from "styled-components";

const WordInside = styled(PageInside)`
    padding-bottom: 1rem;
    border-bottom: 1px solid #e8e8e8;
`;

const WordTitle = styled.div`
    display: flex;
`;

const WordTitleGloss = styled.div`
    flex: 1;
`;

const WordTitleNumber = styled.div`
    font-family: Figgins;
    margin-left: 2rem;
`;

const WordHypernyms = styled.div`
    display: flex;
    flex-wrap: wrap;
    opacity: 0.5;
    > div:not(:last-child) {
        &::after {
            content: "›";
            margin: 0 0.333rem;
            opacity: 0.5;
        }
    }
`;

function Ucfirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const DumbWord = ({ antonyms, word, hypernyms, pieces, createLink, props }) => (
    <Page>
        <PageScroll>
            <WordInside>
                <WordTitle>
                    <WordTitleGloss>
                        <span>
                            <span style={{ fontVariant: "small-caps" }}>
                                {Ucfirst(word.lemma)}.
                            </span>{" "}
                            {Ucfirst(word.gloss.split(";")[0].trim())}.
                        </span>
                        {antonyms[0] ? (
                            <span>
                                <em>&nbsp;not</em>{" "}
                                {Ucfirst(
                                    antonyms[0].gloss.split(";")[0].trim()
                                )}
                                ;{" "}
                            </span>
                        ) : (
                            ""
                        )}
                    </WordTitleGloss>
                    <WordTitleNumber>&times; {pieces.length}</WordTitleNumber>
                </WordTitle>
                <WordHypernyms>
                    {hypernyms.map(hyper => (
                        <div key={hyper.lemma}>
                            {hyper.lemma.replace("_", " ")}
                        </div>
                    ))}
                </WordHypernyms>
            </WordInside>
            {pieces.map(piece => (
                <PieceViewDumb
                    key={piece.title}
                    isInList={true}
                    {...piece}
                    createLink={createLink}
                />
            ))}
        </PageScroll>
        <ActionBar createLink={createLink} {...props} />
    </Page>
);

export default class Word extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loaded: false,
            word: {}
        };
    }

    async getWord(id) {
        const wordContent = await api.getWordById(id);
        this.setState({
            loaded: true,
            word: wordContent
        });
        this.props.updateTitle(`"${wordContent.word.lemma}"`);
    }

    componentDidMount() {
        this.props.updateTitle("⋅");
        this.getWord(this.props.piece);
    }

    render() {
        return !this.state.loaded ? (
            <Loading />
        ) : (
            <DumbWord
                {...this.state.word}
                createLink={this.props.createLink}
                props={this.props}
            />
        );
    }
}
