import fs from 'fs/promises';
import { fetchAlertsData, groupAlertsByTeam } from './alerts.js';
import { fetchConfluencePageContent, updateConfluencePageContent, getCurrentPageVersion } from './confluence.js';
import { formatAlertsHTML } from './format.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const { CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN, CONFLUENCE_PAGE_ID } = process.env;

if (!CONFLUENCE_URL || !CONFLUENCE_USER || !CONFLUENCE_API_TOKEN || !CONFLUENCE_PAGE_ID) {
    console.error('One or more necessary environment variables are missing.');
    process.exit(1);
}

const __dirname = decodeURIComponent(path.dirname(new URL(import.meta.url).pathname));

const localHandler = async (baseDir) => {
    try {
        const environmentFiles = await fs.readdir(baseDir);
        if (environmentFiles.length === 0) {
            console.warn("No alert files found. Please check the directory and file naming.");
            return;
        }

        let allAlerts = [];
        for (const fileName of environmentFiles) {
            if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) {
                console.log(`Processing file: ${fileName}`);
                const alertsData = await fetchAlertsData(fileName, baseDir);
                if (alertsData.length === 0) {
                    console.warn(`No alerts found in ${fileName}.`);
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
        const content = await formatAlertsHTML(groupedAlerts, baseDir);

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
    }
};

localHandler(__dirname);
