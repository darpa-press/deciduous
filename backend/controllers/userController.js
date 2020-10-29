const mongoose = require("mongoose");
require("../models/User");
const connect = require("../utils/connect");
const User = mongoose.model("User");
const md5 = require("md5");

exports.setup = async (req, res) => {
    try {
        const connection = await connect();
        const rowan = await new User({
            name: process.env.DEFAULT_USER,
            password: md5(process.env.DEFAULT_PASS)
        }).save();
        res.json({
            success: true,
            user: rowan
        });
        connection.close();
    } catch (err) {
        res.json({
            success: false,
            error: err
        });
    }
};

exports.getAllUsers = async (req, res, next) => {
    try {
        const connection = await connect();
        const users = await User.find();
        res.json(users);
        connection.close();
    } catch (e) {
        next(e);
    }
};
