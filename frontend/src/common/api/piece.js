import axios from "axios";

const piece = {
    getPiece: async page => {
        const response = await axios.get(`/api/piece/?page=${page}`);
        return response.data;
    },

    getPieceChildren: async parentId => {
        const response = await axios.get(`/api/pieces/?parent=${parentId}`);
        return response.data;
    },

    deletePiece: async id => {
        const response = await axios.delete(`/api/piece/?id=${id}`);
        return response.data;
    },

    getRandomPiece: async () => {
        const response = await axios.get(`/api/piece?random=1`);
        return response.data;
    },

    getTwoNewestPieces: async () => {
        const response = await axios.get(`/api/pieces`);
        return response.data.slice(0, 2);
    },

    getAllPieces: async () => {
        const response = await axios.get(`/api/pieces`);
        const entries = response.data;
        entries.map(entry => {
            sessionStorage[`piece-${entry.page}`] = JSON.stringify(entry);
            return true;
        });
        return response.data;
    },

    getNumberOfPieces: async () => {
        const response = await axios.get(`/api/pieces?count=1`);
        return Number(response.data);
    },

    getXPieces: async to => {
        const response = await axios.get(
            `/api/pieces?sort=page&order=-1&limit=${Number(to)}`
        );
        return response.data;
    },

    getGraph: async () => {
        const response = await axios.get(`/api/pieces?graph=1`);
        return response.data;
    },

    savePiece: async (piece, id) => {
        const url = `/api/piece/?id=${id || ""}`;
        if (id) {
            const response = await axios.put(url, piece);
            return response.data;
        } else {
            const response = await axios.post(url, piece);
            return response.data;
        }
    },

    getTree: async () => {
        const response = await axios.get(`/api/pieces?tree=1`);
        return response.data;
    }
};

export default piece;
