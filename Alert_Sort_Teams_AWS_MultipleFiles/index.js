const { s3, getSecret } = require('./awsServices');
const { fetchAlertsData, groupAlertsByTeam } = require('./alerts');
const { fetchConfluencePageContent, updateConfluencePageContent, getCurrentPageVersion } = require('./confluence');
const { formatAlertsHTML } = require('./formatting');

exports.handler = async (event) => {
    const secretConfig = await getSecret('ConfSecret');
    const CONFLUENCE_URL = secretConfig.CONFLUENCE_URL;
    const CONFLUENCE_USER = secretConfig.CONFLUENCE_USER;
    const CONFLUENCE_API_TOKEN = secretConfig.CONFLUENCE_API_TOKEN;
    const CONFLUENCE_PAGE_ID = secretConfig.CONFLUENCE_PAGE_ID;
    const BUCKET_NAME = 'vxcvdsfvsdvzsdxcv';

    try {
        const params = {
            Bucket: BUCKET_NAME,
            Prefix: '',
        };
        const s3Objects = await s3.listObjectsV2(params).promise();

        if (s3Objects.Contents.length === 0) {
            console.warn("No alert files found in the S3 bucket.");
            return;
        }

        let allAlerts = [];
        for (const obj of s3Objects.Contents) {
            const key = obj.Key;
            if (key.endsWith('.yml') || key.endsWith('.yaml') || key.endsWith('.txt')) {
                console.log(`Processing file: ${key}`);
                const fileContent = await s3.getObject({ Bucket: BUCKET_NAME, Key: key }).promise();
                const alertsData = await fetchAlertsData(fileContent.Body.toString('utf-8'));
                if (alertsData.length === 0) {
                    console.warn(`No alerts found in ${key}.`);
                    continue;
                }
                allAlerts.push(...alertsData);
            }
        }

        if (allAlerts.length === 0) {
            console.warn("No alerts found in any files.");
            return;
        }

        const groupedAlerts = groupAlertsByTeam(allAlerts);
        const content = await formatAlertsHTML(groupedAlerts, '');

        const currentPageVersion = await getCurrentPageVersion(CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN, CONFLUENCE_PAGE_ID);

        if (content && currentPageVersion !== null) {
            const currentConfluenceContent = await fetchConfluencePageContent(CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN, CONFLUENCE_PAGE_ID);
            if (currentConfluenceContent !== null && currentConfluenceContent !== content) {
                await updateConfluencePageContent(CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN, CONFLUENCE_PAGE_ID, content, currentPageVersion);
            } else {
                console.log('No changes detected. Skipping update.');
            }
        } else {
            console.error('Failed to format alerts or fetch current page version.');
        }
    } catch (error) {
        console.error('An unexpected error occurred:', error);
        throw error;
    }
};
