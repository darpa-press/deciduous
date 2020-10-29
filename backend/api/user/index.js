const app = require("../../utils/app");
const authController = require("../../controllers/authenticateController");
const userController = require("../../controllers/userController");

app.get("*", authController.isLoggedIn, userController.getAllUsers);

module.exports = app;
