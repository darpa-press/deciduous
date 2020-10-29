import React from "react";
import styled from "styled-components";
import { DebounceInput } from "react-debounce-input";
import { Card, CardContent } from "Components/CardCatalogue/CardCatalogue";
import { Link } from "react-router-dom";
import api from "common/api";

const SearchContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    left: 0;
    position: fixed;
    top: 0;
    width: 100%;
    padding: 0;
    background: rgba(255, 255, 255, 0.9);
`;

const SearchInputLine = styled.div`
    display: flex;
    align-items: center;
    flex: 0 0 25px;
    user-select: none;
    margin-right: 2rem;
    padding: 1.75rem 1rem 1rem;
`;

const SearchInput = styled(DebounceInput)`
    background: transparent;
    border: 0;
    font-size: 1rem;
    padding: 0;
    margin: 0;
    flex: 1;
    &:focus {
        outline: none;
    }
`;
const SearchSearching = styled.div`
    user-select: none;
`;

const SearchResults = styled.div`
    flex: 0 1 auto;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    flex-wrap: wrap;
    overflow: auto;
    padding: 0 0.5rem 1rem;
`;

const SearchResult = styled.div`
    padding: 0.5rem;
    flex: 0 0 33.3333%;
    min-width: 320px;
    height: 22vw;
    min-height: 240px;
    ${CardContent} {
        min-height: 0;
        height: 100%;
        font-size: 0.85rem;
        transition: all 0.1s ease;
        overflow: auto;
        &:hover {
            border-color: black;
        }
    }
`;

const SearchIconContainer = styled.div`
    position: fixed;
    top: 1rem;
    left: 1rem;
    opacity: 0.3;
    z-index: 1;
    user-select: none;
    cursor: pointer;
    transition: all 0.2s ease;
    &:hover {
        opacity: 0.7;
    }
`;

export const SearchIcon = props => (
    <SearchIconContainer {...props}>⇴</SearchIconContainer>
);

export class SearchScreen extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            searchTerm: "",
            results: [],
            searching: false
        };
    }

    async handleSearch(searchTerm) {
        this.setState({ searching: true });
        const quotedQuery = `"${searchTerm}"`;
        const results = await api.getSearch(quotedQuery);
        this.setState({
            results: results,
            searching: false
        });
    }

    componentDidMount() {
        if (this.state.searchTerm !== "") {
            this.handleSearch(this.state.searchTerm);
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (
            prevState.searchTerm !== this.state.searchTerm &&
            prevState.searchTerm.trim() !== this.state.searchTerm.trim()
        ) {
            this.handleSearch(this.state.searchTerm);
        }
    }

    render() {
        return (
            <SearchContainer
                onClick={e => {
                    if (
                        e.target === e.currentTarget ||
                        e.target.id === "results"
                    ) {
                        this.props.handleDismiss();
                    }
                }}
            >
                <SearchInputLine>
                    <span style={{ marginRight: ".5rem" }}>⇴</span>
                    <SearchInput
                        autoFocus
                        type="search"
                        placeholder="Type to search"
                        minLength={2}
                        debounceTimeout={200}
                        value={this.state.searchTerm}
                        onChange={e =>
                            this.setState({ searchTerm: e.target.value })
                        }
                    />
                    {this.state.searching && (
                        <SearchSearching>...</SearchSearching>
                    )}
                </SearchInputLine>
                {this.state.results &&
                    this.state.results.length > 0 && (
                        <SearchResults id="results">
                            {this.state.results.map(result => (
                                <SearchResult key={result.title}>
                                    <Link
                                        onClick={this.props.handleDismiss}
                                        to={`/${result.page}/index`}
                                    >
                                        <Card
                                            key={result.title}
                                            {...result}
                                            createLink={link =>
                                                `/${link}/index`
                                            }
                                        />
                                    </Link>
                                </SearchResult>
                            ))}
                        </SearchResults>
                    )}
            </SearchContainer>
        );
    }
}
