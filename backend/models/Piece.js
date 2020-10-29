const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const slug = require("slugs");
const autoIncrement = require("mongoose-auto-increment-fix");

autoIncrement.initialize(mongoose);

//
// Piece schema
// The main schema for codex documents
//

const pieceSchema = new mongoose.Schema({
    background: {
        type: String,
        trim: true
    },
    title: {
        type: String,
        trim: true,
        required: "Please enter a title."
    },
    slug: {
        type: String
    },
    page: {
        type: Number
    },
    content: {
        type: String,
        trim: true
    },
    created: {
        type: Date,
        default: Date.now
    },
    stub: {
        type: Boolean,
        default: false
    },
    fullWidth: {
        type: Boolean,
        default: false
    },
    parent: {
        type: mongoose.Schema.ObjectId,
        ref: "Piece"
    },
    persons: [{
        type: mongoose.Schema.ObjectId,
        ref: "Person"
    }],
    lovers: [{
        type: mongoose.Schema.ObjectId,
        ref: "Piece"
    }],
    readme: {
        type: String,
        trim: true
    },
    word: {
        type: [String]
    }
});

// Set up index for text search
pieceSchema.index({
    content: "text",
    title: "text",
    readme: "text"
});

// Add autoincrement for page numbers
pieceSchema.plugin(autoIncrement.plugin, {
    model: "Piece",
    field: "page"
});

// pre-save, generate and add slug to item
pieceSchema.pre("save", async function (next) {
    if (!this.isModified("title")) {
        next();
        return;
    }

    this.slug = slug(this.title);

    const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, "i");
    const piecesWithSlug = await this.constructor.find({
        slug: slugRegEx
    });

    if (piecesWithSlug.length) {
        this.slug = `${this.slug}-${piecesWithSlug.length + 1}`;
    }

    next();
});

module.exports = mongoose.model("Piece", pieceSchema);