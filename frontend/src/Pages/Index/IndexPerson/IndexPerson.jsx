import React from "react";
import { Link } from "react-router-dom";
import ReactTable from "react-table";
import styled from "styled-components";

import api from "common/api";

import "common/css/react-table.css";

import { Page, PageInside, PageScroll } from "Components/Page/Page";
import ActionBar from "Components/ActionBar/ActionBar";
import Loading from "Components/Loading/Loading";

const PersonIndex = styled(Page)``;
const PersonLink = styled(Link)`
    display: block;
    padding: 0.125rem 0;
    @media screen and (min-width: 768px) {
        &:hover {
            opacity: 0.5;
        }
    }
`;

export default class IndexPerson extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            persons: [],
            loaded: false
        };
    }

    async getPersons() {
        if (sessionStorage[`persons`]) {
            this.setState({
                persons: JSON.parse(sessionStorage[`persons`]),
                loaded: true
            });
        }

        const persons = await api.getAllPersons();
        this.setState({ persons: persons, loaded: true });
        sessionStorage[`persons`] = JSON.stringify(persons);
    }

    componentDidMount() {
        this.props.updateTitle(`People`);
        this.getPersons();
    }

    render() {
        if (!this.state.loaded) return <Loading />;

        const columns = [
            {
                Header: "Name",
                accessor: "name",
                Cell: row => (
                    <PersonLink
                        to={this.props.createLink(`p-${row.original.slug}`)}
                    >
                        {row.value}
                    </PersonLink>
                )
            },
            {
                Header: "b.",
                accessor: "birth",
                maxWidth: 120,
                Cell: row => (
                    <div>
                        {row.value
                            ? row.value > 0
                                ? row.value
                                : `BC${Math.abs(row.value)}`
                            : "—"}
                    </div>
                )
            },
            {
                Header: "d.",
                accessor: "death",
                maxWidth: 120,
                Cell: row => (
                    <div>
                        {row.value
                            ? row.value > 0
                                ? row.value
                                : `BC${Math.abs(row.value)}`
                            : "—"}
                    </div>
                )
            }
        ];

        const tableOptions = {
            showPagination: false,
            defaultPageSize: this.state.persons.length,
            resizable: false
        };

        return (
            <PersonIndex>
                <PageScroll>
                    <PageInside>
                        <ReactTable
                            data={this.state.persons}
                            columns={columns}
                            {...tableOptions}
                        />
                    </PageInside>
                </PageScroll>
                <ActionBar {...this.props} />
            </PersonIndex>
        );
    }
}
