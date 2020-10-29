import file from "./api/file";
import person from "./api/person";
import piece from "./api/piece";
import user from "./api/user";
import word from "./api/word";
import search from "./api/search";

// TODO: refactor into having their subobjects

const apiClient = {
    ...file,
    ...person,
    ...piece,
    ...search,
    ...user,
    ...word
};

export default apiClient;