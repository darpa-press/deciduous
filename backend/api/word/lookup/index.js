const app = require("../../../utils/app");
const wordController = require("../../../controllers/wordController");

app.get("*", wordController.lookupWordByString);

module.exports = app;
