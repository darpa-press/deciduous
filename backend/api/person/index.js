const app = require("../../utils/app");

const personController = require("../../controllers/personController");
const authController = require("../../controllers/authenticateController");

app.post("*", authController.isLoggedIn, personController.createPerson);
app.put("*", authController.isLoggedIn, personController.updatePerson);
app.delete("*", authController.isLoggedIn, personController.deletePerson);
app.get("*", personController.getPersonBySlug);

module.exports = app;
