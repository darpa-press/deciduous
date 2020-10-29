const app = require("../../utils/app");
const searchController = require("../../controllers/searchController");

app.get("*", async (req, res, next) => {
    // todo db connection
    return await searchController.getSearch(req, res, next);
});

module.exports = app;
