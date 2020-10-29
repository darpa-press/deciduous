import axios from "axios";

const file = {
    uploadFile: async (formData, config) => {
        const response = await axios.post("/api/file", formData, config);
        return response.data;
    }
};

export default file;
