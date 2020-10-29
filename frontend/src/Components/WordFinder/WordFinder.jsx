import React from "react";
import { DebounceInput } from "react-debounce-input";
import api from "common/api";
import styled from "styled-components";

const WordFinderContainer = styled.div`
    flex: 1;
    margin-bottom: 1rem;
`;

const WordFinderSearch = styled(DebounceInput)`
    border-radius: 2px;
    border: 1px solid #e8e8e8;
    padding: 0.4rem 0.5rem;
    box-sizing: border-box !important;
    width: 100%;
`;

const WordFinderResults = styled.div`
    border: 1px solid #e8e8e8;
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    margin-top: 1rem;
    width: 100%;
`;

const WordFinderResult = styled.div`
    padding: 0.1rem 0.3rem;
    cursor: pointer;
    display: flex;
    &:not(:last-child) {
        border-bottom: 1px solid #e8e8e8;
    }
    &:hover {
        background: #fcfcfc;
    }
`;

const WordFinderResultAdded = styled(WordFinderResult)`
    background: lightblue;
    &:hover {
        background: lightblue;
    }
`;

const WordFinderResultTypeText = styled.div`
    color: rgba(0, 0, 0, 0.5);
    flex: 0 0 1.5rem;
    margin-right: 1rem;
`;

const ChosenWordsContainer = styled.div`
    margin-top: 1rem;
`;

const ChosenWord = styled.div`
    display: flex;
`;

const ChosenWordWord = styled.div`
    flex: 1;
`;

const ChosenWordRemove = styled.div`
    color: red;
    cursor: pointer;
    order: -1;
    margin-right: 0.25rem;
`;

export default class WordFinder extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            searchTerm: "",
            results: []
        };
        this.updateSearchTerm = this.updateSearchTerm.bind(this);
    }

    updateSearchTerm(e) {
        this.setState({
            searchTerm: e.target.value
        });
    }

    async doSearch(term) {
        const results = await api.lookupTerm(term);
        this.setState({
            results: results
        });
    }

    handleClickedWord(word) {
        // check if already in the list
        const isAlreadySelected =
            this.props.selectedWords
                .map(word => word.synsetOffset)
                .indexOf(word.synsetOffset) >= 0;

        if (!isAlreadySelected) {
            // create word entry
            api.createWord(word);
        }

        // pass back to editor component
        this.props.updateWords(word);
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.searchTerm !== this.state.searchTerm) {
            // search term updated, re-search
            this.doSearch(this.state.searchTerm);
        }
    }

    render() {
        const { results, searchTerm } = this.state;
        const { selectedWords } = this.props;

        return (
            <WordFinderContainer>
                <WordFinderSearch
                    minLength={2}
                    debounceTimeout={300}
                    value={searchTerm}
                    placeholder={"Search for words"}
                    onChange={this.updateSearchTerm}
                    type="search"
                />
                {searchTerm !== "" && (
                    <WordFinderResults>
                        {results.length > 0 &&
                            Array.isArray(results) &&
                            results.map(result => {
                                const ChosenResultType =
                                    selectedWords
                                        .map(
                                            alreadySelectedWord =>
                                                alreadySelectedWord.synsetOffset
                                        )
                                        .indexOf(result.synsetOffset) >= 0
                                        ? WordFinderResultAdded
                                        : WordFinderResult;

                                return (
                                    <ChosenResultType
                                        key={result.synsetOffset}
                                        onClick={() =>
                                            this.handleClickedWord({
                                                _id: `${result.synsetOffset}${
                                                    result.pos
                                                }`,
                                                word: searchTerm,
                                                ...result
                                            })
                                        }
                                    >
                                        <WordFinderResultTypeText>
                                            {result.pos === "v" && "verb."}
                                            {result.pos === "n" && "noun."}
                                            {(result.pos === "a" ||
                                                result.pos === "s") &&
                                                "adj."}
                                            {result.pos === "r" && "adv."}
                                        </WordFinderResultTypeText>
                                        <div>{result.gloss.split(";")[0]}</div>
                                    </ChosenResultType>
                                );
                            })}

                        {results.length === 0 &&
                            this.state.searchTerm !== "" && (
                                <div>No results.</div>
                            )}
                    </WordFinderResults>
                )}

                {selectedWords.length > 0 && (
                    <ChosenWordsContainer>
                        {Array.isArray(selectedWords) &&
                            selectedWords.map(word => (
                                <ChosenWord
                                    key={word.synsetOffset}
                                    onClick={() => this.handleClickedWord(word)}
                                >
                                    <ChosenWordWord>
                                        {word.word}, {word.gloss.split(";")[0]}
                                    </ChosenWordWord>
                                    <ChosenWordRemove>&times;</ChosenWordRemove>
                                </ChosenWord>
                            ))}
                    </ChosenWordsContainer>
                )}
            </WordFinderContainer>
        );
    }
}
