const app = require("../../utils/app");

const personController = require("../../controllers/personController");

/* GET users listing. */
// TODO test
app.get("*", personController.getAllPersons);

module.exports = app;
