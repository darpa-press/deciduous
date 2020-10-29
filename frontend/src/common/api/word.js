import axios from "axios";

const word = {
    // GET
    // grab by lookup of id - hits wordnet directly

    getWordById: async id => {
        const response = await axios.get(`/api/word/id/?id=${id || ""}`);
        return response.data;
    },

    // get everything from existing entries - doesn't hit wordnet

    getAllExistingWords: async () => {
        const response = await axios.get(`/api/word`);
        let data = response.data;
        data = data.sort((a, b) => {
            return a.word > b.word ? 1 : -1;
        });
        return data;
    },

    // grab by word

    lookupTerm: async term => {
        const response = await axios.get(
            `/api/word/lookup/?string=${term || ""}`
        );
        return response.data;
    },

    // CREATE/UPDATE/DELETE
    // these are all passed a full wordnet object with additional  '_id' and 'word' items
    createWord: async word => {
        const response = await axios.post("/api/word/", word);
        return response.data;
    },

    updateWord: async word => {
        const response = await axios.put(`/api/word/?id=${word["_id"]}`, word);
        return response.data;
    },

    deleteWord: async word => {
        const response = await axios.delete(`/api/word/?id=${word["_id"]}`);
        return response.data;
    }
};

export default word;
