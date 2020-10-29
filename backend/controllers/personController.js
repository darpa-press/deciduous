const mongoose = require("mongoose");
const connect = require("../utils/connect");
require("../models/Person");
require("../models/Piece");

const Person = mongoose.model("Person");
const Piece = mongoose.model("Piece");

exports.createPerson = async (req, res, next) => {
    try {
        const connection = await connect();
        const person = await new Person(req.body).save();
        res.json(person);
        connection.close();
    } catch (e) {
        console.log(e);
        next(e);
    }
};

exports.updatePerson = async (req, res, next) => {
    try {
        const connection = await connect();
        const person = await Person.findOneAndUpdate(
            { slug: req.query.slug },
            req.body,
            { new: true, runValidators: true }
        ).exec();
        res.json(person);
        connection.close();
    } catch (e) {
        console.log(e);
        next(e);
    }
};

exports.getPersonBySlug = async (req, res, next) => {
    console.log("getting person", req.query.slug);
    try {
        const connection = await connect();
        const person = await Person.findOne({ slug: req.query.slug }).lean();
        if (!person) {
            return next();
        }
        const pieces = await Piece.find({ persons: person["_id"] }).lean();
        if (pieces) {
            person.pieces = pieces;
        }
        res.json(person);
        connection.close();
    } catch (e) {
        console.log(e);
        next(e);
    }
};

exports.getAllPersons = async (req, res, next) => {
    console.log("getting all persons");
    try {
        const connection = await connect();
        const persons = await Person.find().sort({ name: 1 });
        res.json(persons);
        connection.close();
    } catch (e) {
        console.log(e);
        next(e);
    }
};

exports.deletePerson = async (req, res, next) => {
    try {
        const connection = await connect();
        const personDeleted = await Person.remove({ _id: req.query.id });
        res.json(personDeleted);
        connection.close();
    } catch (e) {
        console.log(e);
        next(e);
    }
};
