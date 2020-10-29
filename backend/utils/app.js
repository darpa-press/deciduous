const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

// set up the basics of the app
const app = express();

app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true
    })
);
app.use(cookieParser());

/*
old routes
const authenticate = require("./routes/authenticate");
const file = require("./routes/file");
const person = require("./routes/person");
const piece = require("./routes/piece");
const search = require("./routes/search");
const user = require("./routes/user");
const word = require("./routes/word");
*/
// app.use(morgan("dev"));
/* 
app.use("/api/authenticate", authenticate);
app.use("/api/piece", piece);
app.use("/api/person", person);
app.use("/api/user", user);
app.use("/api/file", file);
app.use("/api/search", search);
app.use("/api/word", word);
*/

module.exports = app;
