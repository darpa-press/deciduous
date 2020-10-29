const listToTree = require("list-to-tree");
const mongoose = require("mongoose");
const WordNet = require("node-wordnet");
const connect = require("../utils/connect");

require("../models/Piece");
require("../models/Word");
require("../models/Person");

const Piece = mongoose.model("Piece");
const Word = mongoose.model("Word");

const escapeRegExp = str =>
    str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");

const getHypernyms = async words => {
    let hasHypernym = true;

    while (hasHypernym) {
        let hypernymFound = false;
        const word = words[words.length - 1];
        const wordnet = new WordNet();
        word.ptrs.forEach(ptr => {
            if (ptr.pointerSymbol == "@") {
                hypernymFound = ptr;
            }
        });

        if (
            hypernymFound &&
            hasHypernym &&
            hypernymFound.synsetOffset != word.synsetOffset
        ) {
            const newWord = await wordnet.getAsync(
                hypernymFound.synsetOffset,
                hypernymFound.pos
            );
            words.push({
                _id: newWord.synsetOffset + newWord.pos,
                ...newWord
            });
        } else {
            hasHypernym = false;
        }
    }

    const wordsToReturn = words.slice(1);

    return wordsToReturn;
};

// words

exports.createWord = async (req, res) => {
    const connection = await connect();
    // grab hypernyms (not created in search)
    const hypernyms = await getHypernyms([req.body]);

    const parent = hypernyms && hypernyms.length ? hypernyms[0]["_id"] : null;

    const newWord = await Word.findOneAndUpdate(
        {
            _id: req.body["_id"]
        },
        { ...req.body, parent: parent },
        {
            new: true,
            runValidators: true,
            upsert: true
        }
    ).exec();

    if (parent) {
        let allHyps = await Promise.all(
            hypernyms.map(async (hypernym, index) => {
                const parentToAdd =
                    index + 1 == hypernyms.length
                        ? null
                        : hypernyms[index + 1]["_id"];

                // loop through and create, with the previous word as a child

                // create word object
                const wordToCreate = {
                    ...hypernym,
                    word: hypernym.lemma,
                    parent: parentToAdd
                };
                // save word object

                const wordSaved = await Word.findOneAndUpdate(
                    {
                        _id: hypernym["_id"]
                    },
                    wordToCreate,
                    {
                        new: true,
                        runValidators: true,
                        upsert: true
                    }
                ).exec();

                return true;
            })
        );
    }

    res.json(newWord);
    connection.close();
};

exports.updateWord = async (req, res) => {
    const connection = await connect();
    const word = await Word.findOneAndUpdate(
        {
            _id: req.query.id
        },
        req.body,
        {
            new: true,
            runValidators: true
        }
    ).exec();
    res.json(word);
    connection.close();
};

exports.deleteWord = async (req, res, next) => {
    const connection = await connect();
    const wordDeleted = await Word.remove({
        _id: req.query.id
    });
    res.json(pieceDeleted);
    connection.close();
};

// OLD

exports.getWordById = async (req, res, next) => {
    try {
        const connection = await connect();
        // initialise wordnet and get initial word
        const wordnet = new WordNet();
        const fullId = req.query.id.slice(2);
        let word = await Word.findOne({
            _id: fullId
        });
        if (!word) {
            // break up request into parts
            const pos = req.query.id.slice(-1);
            const id = Number(req.query.id.slice(2, -1));
            word = await wordnet.getAsync(id, pos);
        }

        const hypernyms = await getHypernyms([word]);

        // filter words and get antonyms in antonym details from synset number
        let antonyms = await Promise.all(
            word.ptrs.map(async ptr => {
                if (ptr.pointerSymbol == "!") {
                    return await wordnet.getAsync(
                        Number(ptr.synsetOffset),
                        ptr.pos
                    );
                } else {
                    return await null;
                }
            })
        );
        antonyms = antonyms.filter(item => item !== null);

        // find pieces that include this word
        const pieces = await Piece.find({
            word: fullId
        })
            .populate("persons")
            .populate("parent")
            .populate({
                path: "word",
                model: "Word"
            })
            .lean();

        // return everything
        res.json({
            word: word,
            pieces: pieces,
            hypernyms: hypernyms,
            antonyms: antonyms
        });
        connection.close();
    } catch (e) {
        next(e);
    }
};

exports.getAllWords = async (req, res, next) => {
    try {
        const connection = await connect();
        const words = await Word.find()
            .select("word pos gloss parent")
            .lean();

        const wordsWithParents = words.map(word => {
            return Object.assign({}, word, {
                id: word["_id"].toString(),
                parent: word.parent ? word.parent.toString() : ""
            });
        });

        var ltt = new listToTree(wordsWithParents, {
            key_id: "id",
            key_parent: "parent",
            key_child: "children"
        });

        var tree = ltt.GetTree();

        const qualities = tree.filter(
            word => word.pos == "a" || word.pos == "v" || word.pos == "s"
        );
        const things = tree.filter(word => word.pos == "n");
        const acts = tree.filter(word => word.pos == "v");

        const fullTree = [
            {
                id: "",
                word: "qualities",
                children: qualities
            },
            {
                id: "",
                word: "things",
                children: things
            },
            {
                id: "",
                word: "acts",
                children: acts
            }
        ];

        res.json(fullTree);
        connection.close();
    } catch (e) {
        next(e);
    }
};

exports.lookupWordByString = async (req, res, next) => {
    try {
        const connection = await connect();
        const wordnet = new WordNet();
        const word = await wordnet.lookupAsync(req.query.string);
        res.json(word);
        connection.close();
    } catch (e) {
        next(e);
    }
};
