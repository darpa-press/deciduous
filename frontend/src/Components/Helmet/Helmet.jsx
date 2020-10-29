import React from "react";
import Helmet from "react-helmet";

export default class DeciduousHelmet extends React.Component {
    render() {
        return (
            <Helmet titleTemplate="%s — Deciduous">
                {this.props.titles ? (
                    <title>{this.props.titles.join(" & ")}</title>
                ) : null}
                {this.props.children}
            </Helmet>
        );
    }
}
