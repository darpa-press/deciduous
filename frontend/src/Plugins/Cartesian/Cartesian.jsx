import React from "react";
import product from "cartesian-product";
import shuffle from "shuffle-array";

export default class Cartesian extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            product: []
        };
    }

    generateProduct(productArray) {
        let thisProduct = product(productArray);
        if (this.props.shuffle) {
            shuffle(thisProduct);
        }
        if (this.props.limit) {
            thisProduct = thisProduct.slice(0, this.props.limit);
        }
        this.setState({
            product: thisProduct
        });
    }

    componentDidMount() {
        this.generateProduct(this.props.contents);
    }

    componentDidUpdate(oldProps, oldState) {
        if (oldProps.contents[0] !== this.props.contents[0]) {
            //this.generateProduct(this.props.contents);
        }
    }

    render() {
        return (
            <div>
                {this.state.product.map((item, index) => (
                    <div key={index}>
                        {item.map(word => <span key={word}>{word} </span>)}
                    </div>
                ))}
            </div>
        );
    }
}
