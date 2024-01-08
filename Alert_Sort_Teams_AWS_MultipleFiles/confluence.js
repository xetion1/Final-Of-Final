const axios = require('axios');

const createConfluenceAPI = (CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN) => {
    return axios.create({
        baseURL: `${CONFLUENCE_URL}/wiki/rest/api`,
        auth: {
            username: CONFLUENCE_USER,
            password: CONFLUENCE_API_TOKEN
        },
        headers: { 'Content-Type': 'application/json' }
    });
};

const fetchConfluencePageContent = async (CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN, CONFLUENCE_PAGE_ID) => {
    const confluenceAPI = createConfluenceAPI(CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN);
    try {
        const response = await confluenceAPI.get(`/content/${CONFLUENCE_PAGE_ID}?expand=body.storage,version`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching Confluence page content: ${error}`);
        return null;
    }
};

const updateConfluencePageContent = async (CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN, CONFLUENCE_PAGE_ID, content, currentPageVersion) => {
    const confluenceAPI = createConfluenceAPI(CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN);
    try {
        const updateData = {
            version: { number: currentPageVersion + 1 },
            title: "Updated Prometheus Alerts",
            type: 'page',
            body: {
                storage: {
                    value: content,
                    representation: 'storage'
                }
            }
        };
        const response = await confluenceAPI.put(`/content/${CONFLUENCE_PAGE_ID}`, updateData);
        console.log(`Data successfully imported to Confluence for ${updateData.title}: ${response.status}`);
    } catch (error) {
        console.error(`Failed to update Confluence page content: ${error}`);
        if (error.response) {
            console.error(`Response status: ${error.response.status}`);
            console.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }
};

const getCurrentPageVersion = async (CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN, CONFLUENCE_PAGE_ID) => {
    const confluenceAPI = createConfluenceAPI(CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN);
    try {
        const response = await confluenceAPI.get(`/content/${CONFLUENCE_PAGE_ID}`);
        return response.data.version.number;
    } catch (error) {
        console.error(`Error fetching current page version: ${error}`);
        return null;
    }
};

module.exports = {
    fetchConfluencePageContent,
    updateConfluencePageContent,
    getCurrentPageVersion
};
