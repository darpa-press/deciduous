import React from "react";
import Select from "react-select";
import { Redirect } from "react-router-dom";

import styled from "styled-components";

import api from "common/api";
import CodeEditor from "Components/CodeEditor/CodeEditor";
import FileUpload from "Components/FileUpload/FileUpload";

import ActionBar from "Components/ActionBar/ActionBar";
import Loading from "Components/Loading/Loading";

import WordFinder from "Components/WordFinder/WordFinder";

import { Page, PageScroll } from "Components/Page/Page";
import {
    CheckboxLabel,
    CombinedInput,
    EditTitle,
    FormButtons,
    FormPage,
    FormFlex
} from "Components/Form/Form";

import "react-select/dist/react-select.css";

const PieceEditContainer = styled(FormPage)``;

export default class PieceEdit extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            background: "",
            content: "",
            existingPersons: [],
            existingPieces: [],
            fullWidth: "",
            loaded: false,
            lovers: "",
            parent: "",
            persons: "",
            redirect: false,
            readme: "",
            stub: "",
            title: "",
            word: [] // New model, object id references
        };
    }

    async getPiece(page) {
        const piece = await api.getPiece(page);
        this.setState({
            ...piece,
            persons:
                piece.persons && piece.persons.length > 0
                    ? piece.persons.map(person => {
                          return person["_id"];
                      })
                    : "",
            parent: piece.parent ? piece.parent["_id"] : "",
            loaded: true
        });
    }

    componentDidMount() {
        this.getPiecesForParent();
        this.getPersons();
        this.props.updateTitle(`Edit person`);
        if (!this.props.new) {
            this.getPiece(this.props.piece.slice(5));
        } else {
            this.setState({ loaded: true });
        }
    }

    // This maps all piece IDs to their titles
    async getPiecesForParent() {
        const pieces = await api.getAllPieces();
        const items = pieces.map(piece => {
            return { value: piece["_id"], label: piece.title };
        });
        this.setState({
            existingPieces: items
        });
    }

    // This maps all person IDs to their titles
    async getPersons() {
        const persons = await api.getAllPersons();
        const items = persons.map(person => {
            return { value: person["_id"], label: person.name };
        });
        this.setState({
            existingPersons: items
        });
    }

    updateWords(word) {
        // this creates links to mongoDB ids in format {synsetOffset}{pos}
        // this is passed a full object including an _id from the word selector

        const newWords =
            this.state.word.map(word => word["_id"]).indexOf(word["_id"]) >= 0
                ? this.state.word.filter(
                      existingWord => existingWord["_id"] !== word["_id"]
                  ) // found, remove it
                : Array.from(new Set([...this.state.word, word])); // not found, add it in and make a unique val set

        this.setState({
            word: newWords
        });
    }

    onCodeChange(newValue, e) {
        this.setState({ content: newValue });
    }

    async doSave(e) {
        e.preventDefault();

        // format the results from the Select boxes into the format required to save
        const formattedPersons =
            this.state.persons && this.state.persons.length > 0
                ? this.state.persons.map(item => {
                      return item.value || item;
                  })
                : null;
        const formattedLovers =
            this.state.lovers && this.state.lovers.length > 0
                ? this.state.lovers.map(item => {
                      return item.value || item;
                  })
                : null;

        // create the model
        const newPiece = await api.savePiece(
            {
                background: this.state.background,
                id: this.state["_id"],
                title: this.state.title,
                content: this.state.content,
                stub: this.state.stub,
                fullWidth: this.state.fullWidth,
                readme: this.state.readme,
                parent: this.state.parent !== "" ? this.state.parent : null,
                lovers: formattedLovers,
                persons: formattedPersons,
                word: this.state.word.map(word => word["_id"])
            },
            this.state["_id"]
        );
        const newLink = this.props.createLink(newPiece.page);
        this.setState({ redirect: newLink });
    }

    async deletePiece(id, page, e) {
        let r = window.confirm("Are you sure you want to delete this piece?");
        if (r) {
            await api.deletePiece(id);
            sessionStorage.removeItem(`piece-${page}`);
            const newPath = this.props.createLink("index");
            this.setState({ redirect: newPath });
        }
    }

    render() {
        if (!this.state.loaded) {
            return <Loading />;
        }
        if (this.state.redirect) {
            return <Redirect to={this.state.redirect} />;
        }

        return (
            <Page>
                <PageScroll>
                    <PieceEditContainer>
                        <EditTitle
                            type="text"
                            name="title"
                            placeholder="Title"
                            value={this.state.title}
                            onChange={e =>
                                this.setState({ title: e.target.value })
                            }
                        />

                        <CodeEditor
                            onChange={this.onCodeChange.bind(this)}
                            value={this.state.content}
                        />

                        <FileUpload />

                        <FormFlex>
                            <label htmlFor="title">Parent</label>
                            <Select
                                className="select"
                                value={this.state.parent}
                                options={this.state.existingPieces}
                                onChange={val =>
                                    this.setState({
                                        parent: val ? val.value : val
                                    })
                                }
                            />
                        </FormFlex>

                        <FormFlex>
                            <label htmlFor="title">Lovers</label>
                            <Select
                                multi={true}
                                className="select"
                                joinValues={true}
                                delimiter={";"}
                                value={this.state.lovers}
                                options={this.state.existingPieces}
                                onChange={val => {
                                    const joinedPieces = val;
                                    this.setState({ lovers: joinedPieces });
                                }}
                            />
                        </FormFlex>

                        <FormFlex>
                            <label htmlFor="title">People</label>
                            <Select
                                multi={true}
                                className="select"
                                joinValues={true}
                                delimiter={";"}
                                value={this.state.persons}
                                options={this.state.existingPersons}
                                onChange={val => {
                                    const joinedValues = val;
                                    this.setState({ persons: joinedValues });
                                }}
                            />
                        </FormFlex>

                        <FormFlex>
                            <label htmlFor="words">Words</label>
                            <WordFinder
                                selectedWords={this.state.word}
                                updateWords={this.updateWords.bind(this)}
                            />
                        </FormFlex>

                        <FormFlex>
                            <label htmlFor="background">BG colour</label>
                            <CombinedInput>
                                <input
                                    type="color"
                                    name="background"
                                    placeholder="Background colour"
                                    value={this.state.background}
                                    onChange={e =>
                                        this.setState({
                                            background: e.target.value
                                        })
                                    }
                                />
                                <input
                                    type="text"
                                    name="background"
                                    placeholder="Background colour"
                                    value={this.state.background}
                                    onChange={e =>
                                        this.setState({
                                            background: e.target.value
                                        })
                                    }
                                />
                            </CombinedInput>
                        </FormFlex>

                        <FormFlex>
                            <label htmlFor="readme">Précis</label>
                            <textarea
                                rows={4}
                                value={this.state.readme}
                                onChange={e =>
                                    this.setState({
                                        readme: e.target.value
                                    })
                                }
                            />
                        </FormFlex>

                        <FormFlex>
                            <label>Stub</label>
                            <CheckboxLabel>
                                <input
                                    type="checkbox"
                                    name="stub"
                                    onChange={e =>
                                        this.setState({
                                            stub: e.target.checked
                                        })
                                    }
                                    checked={this.state.stub}
                                />
                                Stub
                            </CheckboxLabel>
                        </FormFlex>

                        <FormFlex>
                            <label>Full width</label>
                            <CheckboxLabel>
                                <input
                                    type="checkbox"
                                    name="fullWidth"
                                    onChange={e =>
                                        this.setState({
                                            fullWidth: e.target.checked
                                        })
                                    }
                                    checked={this.state.fullWidth}
                                />
                                Full width
                            </CheckboxLabel>
                        </FormFlex>

                        <FormButtons>
                            <button onClick={this.doSave.bind(this)}>
                                Save
                            </button>
                            {!this.props.new && (
                                <button
                                    style={{ color: "red" }}
                                    onClick={e => {
                                        e.preventDefault();
                                        this.deletePiece(
                                            this.state["_id"],
                                            this.state.page,
                                            e
                                        );
                                    }}
                                >
                                    Delete
                                </button>
                            )}
                        </FormButtons>
                    </PieceEditContainer>
                </PageScroll>
                <ActionBar createLink={this.props.createLink} loggedIn={true} />
            </Page>
        );
    }
}
