const app = require("../../utils/app");

const fileController = require("../../controllers/fileController");
const authController = require("../../controllers/authenticateController");

app.post(
    "*",
    authController.isLoggedIn,
    fileController.uploadToS3.single("file"),
    fileController.uploadFile
);

module.exports = app;
