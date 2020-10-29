const app = require("../../utils/app");
const pieceController = require("../../controllers/pieceController");
const authController = require("../../controllers/authenticateController");

app.post("*", authController.isLoggedIn, pieceController.createPiece);
app.put("*", authController.isLoggedIn, pieceController.updatePiece);
app.delete("*", authController.isLoggedIn, pieceController.deletePiece);
app.get("*", pieceController.getPieceByPage);

module.exports = app;
