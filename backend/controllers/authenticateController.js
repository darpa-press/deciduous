const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const md5 = require("md5");
const connect = require("../utils/connect");
require("../models/User");

const User = mongoose.model("User");

exports.authenticate = async (req, res) => {
    try {
        const connection = await connect();
        const thisUser = await User.findOne({ name: req.body.name });
        if (thisUser === null) {
            return res.json({ success: false, message: "Wrong username." });
        }
        if (thisUser.password === md5(req.body.password)) {
            var token = jwt.sign(thisUser, process.env.SECRET, {
                expiresIn: "7d"
            });
            res.json({
                success: true,
                message: "Successfully authenticated.",
                token: token
            });
        } else {
            return res.json({ success: false, message: "Wrong password." });
        }
        connection.close();
    } catch (err) {
        return res.json({
            success: false,
            message: "Could not log you in.",
            err: err
        });
    }
};

exports.isLoggedIn = async (req, res, next) => {
    try {
        const token =
            req.cookies.apiToken ||
            req.body.token ||
            req.query.token ||
            req.headers["x-access-token"];

        if (token) {
            const verify = await jwt.verify(token, process.env.SECRET);
            if (verify.err) {
                return res.json({
                    success: false,
                    message: "Failed to authenticate token."
                });
            } else {
                // all good
                req.decoded = verify.decoded;
                next();
            }
        } else {
            return res.json({
                success: false,
                message: "You are not logged in."
            });
        }
    } catch (e) {
        next(e);
    }
};
