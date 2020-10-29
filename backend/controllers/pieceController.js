const mongoose = require("mongoose");
const connect = require("../utils/connect");
require("../models/Piece");
require("../models/Person");
require("../models/Word");

const Piece = mongoose.model("Piece");
const Person = mongoose.model("Person");
const Word = mongoose.model("Word");
const listToTree = require("list-to-tree");

const graphColors = {
    black: "#555",
    red: "#e41a1c",
    blue: "#377eb8"
};

exports.createPiece = async (req, res) => {
    const connection = await connect();
    const piece = await new Piece(req.body).save();
    res.json(piece);
    connection.close();
};

exports.updatePiece = async (req, res) => {
    const connection = await connect();
    const piece = await Piece.findOneAndUpdate(
        { _id: req.query.id },
        req.body,
        { new: true, runValidators: true }
    ).exec();

    /*

    // Bidrectional lovers
    // Not finished.
    // TODO: add check for if an item is removed... how?

    if (req.body.lovers && req.body.lovers.length > 0) {
        const lovers = req.body.lovers;
        for (let i = 0; i < lovers.length; i++) {
            const lover = lovers[i];
            const targetPiece = await Piece.findById(lover);

            const newLovers =
                targetPiece.lovers && targetPiece.lovers.length > 0
                ? targetPiece.lovers.map(item => {return item.toString()})
                : [];
            newLovers.push(req.query.id);
            targetPiece.lovers = unique(newLovers);
            targetPiece.save();
        }
    }
    */

    res.json(piece);
    connection.close();
};

exports.deletePiece = async (req, res, next) => {
    const connection = await connect();
    const pieceDeleted = await Piece.remove({ _id: req.query.id });
    res.json(pieceDeleted);
    connection.close();
};

exports.getPieceByPage = async (req, res, next) => {
    const connection = await connect();
    const piece = await Piece.findOne({ page: req.query.page })
        .populate("persons")
        .populate("parent")
        .populate({
            path: "word",
            model: "Word"
        });
    // fake populate
    /*
    piece.word = await Promise.all(
        piece.word.map(async wordId => Word.findOne({ _id: wordId }))
    );
    */

    if (!piece) {
        return next();
    }
    res.json(piece);
    connection.close();
};

const getCount = async (req, res) => {
    const number = await Piece.count();
    return number;
};

const getGraph = async (req, res) => {
    let nodes = [];
    let edges = [];

    const persons = await Person.find().lean();

    // loop through pieces
    for (let i = 0; i < persons.length; i++) {
        const person = persons[i];

        // add piece to nodes (id)
        nodes.push({
            id: person["_id"],
            label: person.name,
            slug: person.slug,
            link: `p-${person.slug}`,
            type: "person",
            color: { background: "white", border: graphColors.blue }
        });
    }

    // get all pieces
    const pieces = await Piece.find().lean();

    // loop through pieces
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];

        // add piece to nodes (id)
        nodes.push({
            id: piece["_id"],
            label: piece.title,
            page: piece.page,
            link: piece.page,
            type: "piece",
            color: { background: "white", border: graphColors.black }
        });

        // add parent-this to points
        if (piece.parent) {
            edges.push({
                from: piece["_id"],
                to: piece.parent,
                color: {
                    color: graphColors.black,
                    inherit: false
                }
            });
        }

        if (piece.persons && piece.persons.length > 0) {
            for (let i = 0; i < piece.persons.length; i++) {
                edges.push({
                    from: piece["_id"],
                    to: piece.persons[i],
                    color: {
                        color: graphColors.blue,
                        inherit: false
                    },
                    dashes: true
                });
            }
        }

        if (piece.lovers && piece.lovers.length > 0) {
            for (let i = 0; i < piece.lovers.length; i++) {
                edges.push({
                    from: piece["_id"],
                    to: piece.lovers[i],
                    color: {
                        color: graphColors.red,
                        inherit: false
                    }
                    //dashes: true
                });
            }
        }
    }

    // return nodes, points object

    return {
        nodes: nodes,
        edges: edges
    };
};

const getParent = async (req, res) => {
    const childPieces = await Piece.find({
        parent: req.query.parent
    }).lean();
    return childPieces;
};

const getTree = async (req, res) => {
    const pieces = await Piece.find().lean();
    const piecesWithAllParents = pieces.map(piece => {
        return Object.assign({}, piece, {
            id: piece["_id"].toString(),
            parent: piece.parent ? piece.parent.toString() : ""
        });
    });

    var ltt = new listToTree(piecesWithAllParents, {
        key_id: "id",
        key_parent: "parent",
        key_child: "children"
    });
    var tree = ltt.GetTree();
    return tree;
};

getRegularAllPieces = async (req, res) => {
    const sortVariable = req.query.sort || "title";
    const sortOrder = Number(req.query.order) || 1;
    const pieces = await Piece.find()
        .limit(Number(req.query.limit) || null)
        .sort({ [sortVariable]: sortOrder })
        .lean();
    const piecesWithAAs = pieces.map(piece => {
        return {
            ...piece,
            hasLink: piece.content.toLowerCase().indexOf("<aa") > -1
        };
    });
    return piecesWithAAs;
};

exports.getAllPieces = async (req, res, next) => {
    try {
        const connection = await connect();
        if (req.query.count) {
            res.json(await getCount(req, res));
        } else if (req.query.graph) {
            res.json(await getGraph(req, res));
        } else if (req.query.parent) {
            res.json(await getParent(req, res));
        } else if (req.query.tree) {
            res.json(await getTree(req, res));
        } else {
            res.json(await getRegularAllPieces(req, res));
        }
        connection.close();
    } catch (error) {
        next(error);
    }
};
