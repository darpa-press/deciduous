const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');
const autoIncrement = require('mongoose-auto-increment-fix');

autoIncrement.initialize(mongoose);

//
// Person schema
// For people entries in the codex 
//

const personSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: 'Please enter a name.'
    },
    slug: {
        type: String
    },
    bio: {
        type: String,
        trim: true
    },
    birth: Number,
    death: Number,
    created: {
        type: Date,
        default: Date.now
    },
    relation: [{
        relatedPerson: {
            type: mongoose.Schema.ObjectId,
            ref: 'Person'
        },
        relatedReason: String
    }]
});

personSchema.pre('save', async function (next) {

    if (!this.isModified('name')) {
        next();
        return;
    }
    this.slug = slug(this.name);

    const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
    const personsWithSlug = await this.constructor.find({
        slug: slugRegEx
    });

    if (personsWithSlug.length) {
        this.slug = `${this.slug}-${personsWithSlug.length+1}`;
    }

    next();
});

module.exports = mongoose.model('Person', personSchema);