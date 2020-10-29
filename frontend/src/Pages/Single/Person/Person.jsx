import React from "react";
import api from "common/api";
import ActionBar from "Components/ActionBar/ActionBar";
import Loading from "Components/Loading/Loading";
import { PieceViewDumb } from "Components/PieceDumb/PieceDumb";
import { Page, PageInside, PageScroll } from "Components/Page/Page";

import styled from "styled-components";

const PersonInside = styled(PageInside)`
    border-bottom: 1px solid #e8e8e8;
`;

const PersonVitals = styled.div`
    margin-bottom: 1rem;
`;

const PersonBio = styled.div`
    font-style: italic;
    em {
        font-style: normal;
    }
`;

const PersonYears = styled.div`
    font-family: "FigginsItalic", -apple-system, BlinkMacSystemFont, sans-serif;
`;

const DumbPerson = ({
    bio,
    birth,
    createLink,
    date,
    death,
    name,
    pieces,
    props,
    slug
}) => (
    <Page>
        <PageScroll>
            <PersonInside>
                <PersonVitals>
                    <div>{name}</div>
                    <PersonYears>
                        {birth || ""}—{death || ""}
                    </PersonYears>
                </PersonVitals>
                <PersonBio dangerouslySetInnerHTML={{ __html: bio }} />
            </PersonInside>

            {pieces &&
                pieces.length > 0 && (
                    <div>
                        {pieces.map(piece => (
                            <PieceViewDumb
                                key={piece.title}
                                {...piece}
                                isInList={true}
                                createLink={createLink}
                            />
                        ))}
                    </div>
                )}
        </PageScroll>
        <ActionBar {...props} editLink={createLink(`edit-person-${slug}`)} />
    </Page>
);

export default class Person extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loaded: false,
            editing: false,
            person: {}
        };
    }

    async getPerson(slug) {
        if (sessionStorage[`person-${slug}`]) {
            this.setState({
                person: JSON.parse(sessionStorage[`person-${slug}`]),
                loaded: true
            });
        }

        const person = await api.getPersonBySlug(slug);
        this.setState({
            loaded: true,
            person: person
        });
        this.props.updateTitle(person.name);
    }

    componentDidMount() {
        this.props.updateTitle("⋅");
        this.getPerson(this.props.piece.slice(2));
    }

    render() {
        return !this.state.loaded ? (
            <Loading />
        ) : (
            <DumbPerson
                {...this.state.person}
                createLink={this.props.createLink}
                props={this.props}
            />
        );
    }
}
