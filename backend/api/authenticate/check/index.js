const mongoose = require("mongoose");
const app = require("../../../utils/app");

const authenticateController = require("../../../controllers/authenticateController");

app.post("*", authenticateController.isLoggedIn);

module.exports = app;
