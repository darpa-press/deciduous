import axios from "axios";

const search = {
    getSearch: async term => {
        if (term && term !== "") {
            const response = await axios.get(`/api/search?q=${term}`);
            return response.data;
        }
    }
};

export default search;
