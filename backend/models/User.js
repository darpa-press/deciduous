const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var uniqueValidator = require('mongoose-unique-validator');

//
// User schema
// For user/pass logins
// These are currently manually created
// TODO: add method to create user on launch
//

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true
    },
    password: String
});

userSchema.plugin(uniqueValidator);
module.exports = mongoose.model('User', userSchema);