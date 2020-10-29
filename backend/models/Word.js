const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const slug = require("slugs");

//
// Pointer schema
// (Nested)
// matching WordNet's
const PointerSchema = new mongoose.Schema({
    pointerSymbol: String,
    synsetOffset: Number,
    pos: String,
    sourceTarget: String
});

// 
// Word schema
// Matching Wordnet's
// with additional properties:
//  * '_id' (eg w-{offset}{pos} and 
//  * 'word', which is the word as it is searched (the particular one, leading to the lemma))
// 

const wordSchema = new mongoose.Schema({
    _id: {
        type: String
    },
    word: {
        type: String
    },
    synsetOffset: {
        type: Number
    },
    lexFilenum: {
        type: Number
    },
    pos: {
        type: String
    },
    wCnt: {
        type: Number
    },
    lemma: {
        type: String
    },
    synonyms: {
        type: [String]
    },
    lexId: {
        type: String
    },
    ptrs: {
        type: [PointerSchema]
    },
    gloss: {
        type: String
    },
    def: {
        type: String
    },
    exp: {
        type: [String]
    },
    parent: {
        type: String,
        ref: 'Story'
    }
});

mongoose.exports = mongoose.model("Word", wordSchema);