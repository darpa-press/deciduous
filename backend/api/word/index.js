const app = require("../../utils/app");
const authController = require("../../controllers/authenticateController");
const wordController = require("../../controllers/wordController");

app.post("*", authController.isLoggedIn, wordController.createWord);
app.put("*", authController.isLoggedIn, wordController.updateWord);
app.delete("*", authController.isLoggedIn, wordController.deleteWord);
app.get("*", wordController.getAllWords);

module.exports = app;
