import React from "react";
import styled from "styled-components";
import { Link, withRouter } from "react-router-dom";
import transition from "styled-transition-group";

const SmallCaps = styled.span`
    font-variant: small-caps;
    letter-spacing: 0.5px;
    text-transform: lowercase;
`;

const CardOverlay = styled.div`
    align-content: center;
    background: rgba(255, 255, 255, 0.75);
    display: flex;
    flex-direction: column;
    font-size: 0.9rem;
    height: calc(100vh - 2.5rem);
    justify-content: center;
    left: 0;
    line-height: 1.2rem;
    padding: 2rem;
    position: absolute;
    top: 0;
    width: 100%;
    z-index: 20;
`;

export const CardContent = styled.div`
    background: white;
    /* border: 1px solid #ececec; */
    border-radius: 2px;
    box-shadow: 0px 3px 9px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-height: 25vw;
    padding: 3em 2em 1em 15%;
    width: 100%;
    z-index: 2;
`;

const CardMeta = styled.div`
    display: flex;
    justify-content: space-between;
    margin-top: auto;
`;

const CardPeople = styled.div`
    display: flex;
    margin: 2em 0 2em 1.5em;
`;

const CardPerson = styled.div`
    margin-right: 1em;
`;

const CardMain = styled.div``;

const CardMainTitle = styled.div`
    display: inline;
    font-variant: small-caps;
    margin-right: 0.5em;
    letter-spacing: 0.5px;
`;

const CardMainBackground = styled.div`
    text-indent: 1.5em;
    display: inline;
`;

const CardMainInherit = styled.div`
    font-size: 0.9em;
    margin-bottom: 0.5em;
    margin-left: 1.6666em;
    margin-top: 0.5em;
`;

const CardMainWords = styled.div`
    text-indent: 1.5em;
`;

const Word = styled.span``;

const transitionSpeed = 300;

const BounceCardUp = transition.div`
    &:enter,
    &:appear {
        margin-top:150%;
    }
    &:enter-active,
    &:appear-active {
        margin-top: 0%;
        transition: all ${transitionSpeed}ms cubic-bezier(0.19, 1, 0.22, 1);
    }
`;

export class Card extends React.Component {
    render() {
        const {
            page,
            readme,
            persons,
            parent,
            title,
            word,
            createLink
        } = this.props;
        return (
            <CardContent>
                <CardMain>
                    <div>
                        <CardMainTitle>
                            <Link to={createLink(page)}>{title}</Link>.
                        </CardMainTitle>
                        <CardMainBackground>
                            {readme || (
                                <span style={{ opacity: 0.2 }}>
                                    (No summary available)
                                </span>
                            )}
                        </CardMainBackground>
                    </div>
                    <CardMainInherit>
                        {parent && (
                            <Link to={createLink(parent.page, true)}>
                                @{parent.title}
                            </Link>
                        )}
                    </CardMainInherit>
                    <CardMainWords>
                        <SmallCaps>Words</SmallCaps>—
                        {word &&
                            word.length > 0 &&
                            word.map((item, index) => {
                                return (
                                    <Word key={item.word}>
                                        <Link
                                            to={createLink(
                                                `w-${item.synsetOffset}${
                                                    item.pos
                                                }`,
                                                true
                                            )}
                                        >
                                            {index ? ", " : ""}
                                            {index % 2 === 0 && item.gloss
                                                ? item.gloss
                                                      .split(";", 1)[0]
                                                      .trim()
                                                : item.word
                                                ? item.word.trim()
                                                : ""}
                                        </Link>
                                    </Word>
                                );
                            })}
                    </CardMainWords>
                </CardMain>
                <CardPeople>
                    {persons &&
                        persons.map((person, index) => (
                            <CardPerson key={person.name}>
                                <Link to={createLink(`p-${person.slug}`, true)}>
                                    {index + 1}. {person.name} ({person.birth})
                                </Link>
                            </CardPerson>
                        ))}
                </CardPeople>
                <CardMeta>
                    <div className="card-meta__codex-name">
                        <SmallCaps>Deciduous</SmallCaps>
                        /Arbes san sang
                    </div>
                    <div className="card-meta__page">
                        DC001.
                        {this.props.page}
                    </div>
                </CardMeta>
            </CardContent>
        );
    }
}

class CardWithOverlay extends React.Component {
    handleClick(e) {
        if (e.target === e.currentTarget) {
            this.props.history.push(
                this.props.createLink(this.props.piece.slice(0, -1))
            );
        }
    }
    render() {
        return (
            <CardOverlay onClick={e => this.handleClick(e)}>
                <BounceCardUp in={true} timeout={transitionSpeed} appear={true}>
                    <Card {...this.props} />
                </BounceCardUp>
            </CardOverlay>
        );
    }
}

export default withRouter(CardWithOverlay);
