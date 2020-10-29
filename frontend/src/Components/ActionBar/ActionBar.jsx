import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import Tool from "Components/Tool/Tool";

import iconNew from "./icon-new.png";
import iconIndex from "./icon-tree.png";
import iconGraph from "./icon-graph.png";
import iconWord from "./icon-word.png";
import iconPersons from "./icon-persons.png";
import iconEdit from "./icon-edit.png";
import iconCard from "./icon-card.png";

const ActionBarInside = styled.div`
    background: white;
    border-top: 1px solid #e8e8e8;
    display: flex;
    justify-content: space-between;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    > * {
        opacity: 0.5;
        transition: all 0.2s ease;
    }
`;

const ActionBar = styled.div`
    font-family: "Figgins", -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 0.8rem;
    transition: all 0.2s ease;
    user-select: none;
    width: 100%;
    z-index: 2;

    @media screen and (max-width: 768px) {
        bottom: 0;
        left: 0;
        position: fixed;
    }

    @media screen and (min-width: 768px) {
        :hover ${ActionBarInside} > * {
            opacity: 1;
        }
    }
`;

const ActionBarIcons = styled.div`
    align-items: center;
    display: flex;
    justify-content: flex-start;

    @media screen and (max-width: 767px) {
        justify-content: space-between;
        width: 100%;
    }
`;

const IconLink = styled(Link)`
    align-items: center;
    cursor: pointer;
    display: flex;
    height: 2.5rem;
    justify-content: center;
    opacity: 0.8;
    transition: all 0.2s ease;
    @media screen and (min-width: 768px) {
        &:hover {
            background: #f3f3f3;
            opacity: 1;
        }
    }
    :focus {
        outline: none;
    }
`;

const IconImage = styled.img`
    height: auto;
    margin: 0.25rem 0.75rem;
    max-height: 1.125rem;
    max-width: 1.125rem;
    vertical-align: bottom;
    width: auto;
`;

export default ({
    cardLink,
    children,
    createLink,
    editLink,
    loggedIn,
    parent,
    persons,
    width
}) => {
    createLink = createLink ? createLink : id => id; // TODO: this is hacky!
    return (
        <ActionBar>
            <ActionBarInside>
                <ActionBarIcons>
                    <Tool label="Index">
                        <IconLink to={createLink("index")}>
                            <IconImage src={iconIndex} />
                        </IconLink>
                    </Tool>

                    <Tool label="Graph">
                        <IconLink to={createLink("graph")}>
                            <IconImage src={iconGraph} />
                        </IconLink>
                    </Tool>

                    <Tool label="Word calendar">
                        <IconLink to={createLink("word")}>
                            <IconImage src={iconWord} />
                        </IconLink>
                    </Tool>

                    <Tool label="People">
                        <IconLink to={createLink("person")}>
                            <IconImage src={iconPersons} />
                        </IconLink>
                    </Tool>
                </ActionBarIcons>
                <ActionBarIcons>
                    {cardLink && (
                        <Tool label="Card">
                            <IconLink to={createLink(cardLink)}>
                                <IconImage src={iconCard} />
                            </IconLink>
                        </Tool>
                    )}

                    {loggedIn && (
                        <Tool label="New piece">
                            <IconLink to={createLink("new")}>
                                <IconImage src={iconNew} />
                            </IconLink>
                        </Tool>
                    )}

                    {loggedIn && editLink && (
                        <Tool label="Edit">
                            <IconLink data-tip="Edit" to={editLink}>
                                <IconImage src={iconEdit} />
                            </IconLink>
                        </Tool>
                    )}
                </ActionBarIcons>
            </ActionBarInside>
        </ActionBar>
    );
};
