const app = require("../../utils/app");
const pieceController = require("../../controllers/pieceController");

app.get("*", pieceController.getAllPieces);

module.exports = app;
