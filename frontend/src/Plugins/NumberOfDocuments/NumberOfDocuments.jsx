import React from "react";
import api from "common/api";

export default class NumberOfDocuments extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            number: "000",
            loaded: false
        };
    }

    async getNumber() {
        const number = await api.getNumberOfPieces();
        this.setState({
            loaded: true,
            number: number
        });
    }

    componentDidMount() {
        this.getNumber();
    }

    render() {
        return <span>{this.state.number}</span>;
    }
}
