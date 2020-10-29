const mongoose = require("mongoose");

const connect = async () => {
    if (mongoose.connection.readyState == 1) {
        return mongoose.connection;
    } else {
        await mongoose.connect(process.env.DATABASE, {
            bufferCommands: false,
            bufferMaxEntries: 0,
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        return mongoose.connection;
    }
};

module.exports = connect;
