import React from "react";
import { Redirect } from "react-router-dom";
import styled from "styled-components";

import api from "common/api";

import ActionBar from "Components/ActionBar/ActionBar";
import CodeEditor from "Components/CodeEditor/CodeEditor";
import Loading from "Components/Loading/Loading";
import { Page, PageScroll } from "Components/Page/Page";
import {
    CombinedInput,
    EditTitle,
    FormButtons,
    FormPage,
    FormFlex
} from "Components/Form/Form";

const PersonEditContainer = styled(FormPage)``;

export default class PersonEdit extends React.Component {
    constructor(props) {
        super(props);

        this.emptyRelation = {
            relatedPerson: "",
            relatedReason: ""
        };

        this.state = {
            name: "",
            slug: false,
            bio: "",
            birth: null,
            death: null,
            relation: [this.emptyRelation], // array of objects with relatedPerson, relatedReason,
            personsSelect: [],
            redirect: false,
            loaded: false
        };
    }

    async getPerson(slug) {
        const person = await api.getPersonBySlug(slug);
        this.setState({
            ...person,
            relation: [...person.relation, this.emptyRelation],
            loaded: true
        });
    }

    componentDidMount() {
        this.props.updateTitle(`Edit person`);
        if (!this.props.new) {
            const slug = this.props.piece.slice(12);
            this.setState({ slug: slug });
            this.getPerson(slug);
        } else {
            this.setState({ loaded: true });
        }
        this.getPersonsForRelation();
    }

    async getPersonsForRelation() {
        const persons = await api.getAllPersons();
        const items = persons.map(person => {
            return { value: person["_id"], label: person.name };
        });
        this.setState({
            personsSelect: items
        });
    }

    async doSave(e) {
        e.preventDefault();
        const newPerson = await api.savePerson(
            {
                id: this.props["_id"],
                name: this.state.name,
                bio: this.state.bio,
                birth: this.state.birth,
                death: this.state.death,
                relation: this.state.relation.filter(
                    rel =>
                        rel.relatedPerson !== "" && rel.relatedPerson !== null
                )
            },
            this.state.slug
        );
        this.setState({
            redirect: this.props.createLink(`p-${newPerson.slug}`)
        });
    }

    async deletePerson(id, slug, e) {
        let r = window.confirm("Are you sure you want to delete this person?");
        if (r) {
            await api.deletePerson(id);
            sessionStorage.removeItem(`person-${slug}`);
            const newPath = this.props.createLink("person");
            this.setState({ redirect: newPath });
        }
    }

    updateRelations(newIndex, newId, newReason) {
        const newRelations = [...this.state.relation];
        newRelations[newIndex] = {
            relatedPerson: newId,
            relatedReason: newReason
        };

        this.setState({
            relation: newRelations
        });
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
                    <PersonEditContainer>
                        <EditTitle
                            type="text"
                            name="name"
                            placeholder="Name"
                            value={this.state.name}
                            onChange={e =>
                                this.setState({ name: e.target.value })
                            }
                        />

                        <CodeEditor
                            onChange={(newValue, e) =>
                                this.setState({ bio: newValue })
                            }
                            value={this.state.bio}
                        />

                        <FormFlex>
                            <label>Life</label>
                            <CombinedInput>
                                <input
                                    type="text"
                                    name="birth"
                                    placeholder="Birth"
                                    value={this.state.birth}
                                    onChange={e =>
                                        this.setState({ birth: e.target.value })
                                    }
                                />
                                <span>—</span>
                                <input
                                    type="text"
                                    name="death"
                                    placeholder="Death"
                                    value={this.state.death}
                                    onChange={e =>
                                        this.setState({ death: e.target.value })
                                    }
                                />
                            </CombinedInput>
                        </FormFlex>

                        {/*

                            <FormFlex>
                                <label>Relations</label>

                                {this.state.relation.length > 0 &&
                                    this.state.relation.map((rel, index) => {
                                        const targetPerson = this.state.relation[
                                            index
                                        ].relatedPerson;
                                        const targetReason = this.state.relation[
                                            index
                                        ].relatedReason;

                                        return (
                                            <div key={index}>
                                                <Select
                                                    className="select"
                                                    value={targetPerson}
                                                    options={
                                                        this.state.personsSelect
                                                    }
                                                    placeholder="Related person"
                                                    onChange={val =>
                                                        this.updateRelations(
                                                            index,
                                                            val ? val.value : val,
                                                            targetReason
                                                        )
                                                    }
                                                />
                                                <input
                                                    value={targetReason}
                                                    type="text"
                                                    placeholder="Reason for relation"
                                                    onChange={e =>
                                                        this.updateRelations(
                                                            index,
                                                            targetPerson,
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </div>
                                        );
                                    })}

                                <Select
                                    className="select"
                                    value={this.state.relation[this.state.relation.length+1]}
                                    options={this.state.personsSelect}
                                    onChange={(val) => this.setState({relation: val ? val.value : val})}
                                />

                            </FormFlex>
                        */}

                        <FormButtons>
                            <button onClick={this.doSave.bind(this)}>
                                Save
                            </button>
                            {!this.props.new && (
                                <button
                                    style={{ color: "red" }}
                                    onClick={e => {
                                        e.preventDefault();
                                        this.deletePerson(
                                            this.state["_id"],
                                            this.state.slug,
                                            e
                                        );
                                    }}
                                >
                                    Delete
                                </button>
                            )}
                        </FormButtons>
                    </PersonEditContainer>
                </PageScroll>
                <ActionBar {...this.props} />
            </Page>
        );
    }
}
