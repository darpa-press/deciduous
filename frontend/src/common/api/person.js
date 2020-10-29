import axios from "axios";

const person = {
    getAllPersons: async () => {
        const response = await axios.get(`/api/persons`);
        const persons = response.data;

        persons.map(person => {
            sessionStorage[`person-${person.slug}`] = JSON.stringify(person);
            return true;
        });

        return persons;
    },

    getPersonBySlug: async slug => {
        const response = await axios.get(`/api/person/?slug=${slug}`);
        const person = response.data;
        return person;
    },

    savePerson: async (personData, slug) => {
        const url = `/api/person/?slug=${slug || ""}`;
        if (slug) {
            const response = await axios.put(url, personData);
            return response.data;
        } else {
            const response = await axios.post(url, personData);
            return response.data;
        }
    },

    deletePerson: async id => {
        const response = await axios.delete(`/api/person/?id=${id}`);
        return response.data;
    }
};

export default person;
