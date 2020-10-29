import axios from "axios";

const user = {
    login: async details => {
        const response = await axios.post(`/api/authenticate`, details);
        if (response.data.success) {
            return response.data;
        } else {
            return false;
        }
    }
};
export default user;
