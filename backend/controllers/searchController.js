const mongoose = require("mongoose");
const connect = require("../utils/connect");
require("../models/Piece");
require("../models/Person");
require("../models/Word");
const Piece = mongoose.model("Piece");

exports.getSearch = async (req, res, next) => {
    try {
        const connection = await connect();
        if (!req.query.q) {
            res.json({
                success: 0,
                error: "Please enter a search term"
            });
        }
        const pieces = await Piece.find({
            $text: { $search: req.query.q }
        })
            .populate("persons")
            .populate("parent")
            .populate({
                path: "word",
                model: "Word"
            })
            .lean();
        res.json(pieces);
        connection.close();
    } catch (e) {
        next(e);
    }
};
