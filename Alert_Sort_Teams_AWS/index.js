// index.js

const AWS = require('aws-sdk');
const yaml = require('js-yaml');
const axios = require('axios');

// Initialize AWS SDK for S3 and Secrets Manager
const s3 = new AWS.S3();
const secretsManager = new AWS.SecretsManager();

// ----------------------------- Utils -----------------------------

const escapeHTML = (str) => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const extractThresholdFromExpr = (expr) => {
    const thresholdMatch = expr.match(/\b\d+(\.\d+)?$/);
    return thresholdMatch ? thresholdMatch[0] : 'N/A';
};

// ----------------------------- Alerts -----------------------------

const fetchAlertsData = async (fileContent) => {
    try {
        const data = yaml.load(fileContent);
        return processAlertData(data);
    } catch (error) {
        console.error(`Error reading file: ${error}`);
        return [];
    }
};

const processAlertData = (data) => {
    if (!data || !data.groups || !Array.isArray(data.groups)) {
        console.warn('Invalid or unexpected data structure in YAML file');
        return [];
    }

    let alerts = [];
    data.groups.forEach(group => {
        if (group.rules && Array.isArray(group.rules)) {
            group.rules.forEach(rule => {
                if (rule.alert && rule.expr) {
                    const threshold = extractThresholdFromExpr(rule.expr);
                    const environment = rule.labels?.env || 'N/A';

                    let existingAlert = alerts.find(a => a.alertName === rule.alert);
                    if (existingAlert) {
                        existingAlert.environments.add(environment);
                    } else {
                        alerts.push({
                            alertName: rule.alert,
                            description: rule.annotations?.description || 'N/A',
                            summary: rule.annotations?.summary || 'N/A',
                            duration: rule.for || 'N/A',
                            component: rule.labels?.component || 'N/A',
                            link: rule.labels?.link?.join(', ') || 'N/A',
                            runbook: rule.labels?.runbook?.join(', ') || 'N/A',
                            service: rule.labels?.service || 'N/A',
                            team: rule.labels?.team || 'Unknown',
                            severity: rule.labels?.sev || 'N/A',
                            threshold: threshold,
                            expr: rule.expr,
                            environments: new Set([environment])
                        });
                    }
                }
            });
        }
    });
    return alerts;
};

const groupAlertsByTeam = (alertsData) => {
    const uniqueAlerts = new Map();
    alertsData.forEach(alert => {
        const team = alert.team || 'Unknown';
        const alertKey = `${team}-${alert.alertName}`;

        if (uniqueAlerts.has(alertKey)) {
            const existingAlert = uniqueAlerts.get(alertKey);
            alert.environments.forEach(env => existingAlert.environments.add(env));
        } else {
            uniqueAlerts.set(alertKey, { ...alert, environments: new Set(alert.environments) });
        }
    });

    const groupedAlerts = Array.from(uniqueAlerts.values()).reduce((grouped, alert) => {
        const team = alert.team || 'Unknown';
        if (!grouped[team]) {
            grouped[team] = [];
        }
        grouped[team].push(alert);
        return grouped;
    }, {});

    return groupedAlerts;
};

// ----------------------------- Confluence -----------------------------

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

// ----------------------------- Formatting -----------------------------

const createTableHeader = () => {
    return `
        <tr>
            <th style="background-color: #f4f5f7;">Alert Name</th>
            <th style="background-color: #f4f5f7;">Description</th>
            <th style="background-color: #f4f5f7;">Summary</th>
            <th style="background-color: #f4f5f7;">Duration</th>
            <th style="background-color: #f4f5f7;">Component</th>
            <th style="background-color: #f4f5f7;">Link</th>
            <th style="background-color: #f4f5f7;">Runbook</th>
            <th style="background-color: #f4f5f7;">Service</th>
            <th style="background-color: #f4f5f7;">Environment</th>
            <th style="background-color: #f4f5f7;">Severity</th>
            <th style="background-color: #f4f5f7;">Threshold</th>
            <th style="background-color: #f4f5f7;">Expression</th>
        </tr>
    `;
};

const createTableRow = (alert) => {
    return `
        <tr>
            <td>${escapeHTML(alert.alertName || 'N/A')}</td>
            <td>${escapeHTML(alert.description || 'N/A')}</td>
            <td>${escapeHTML(alert.summary || 'N/A')}</td>
            <td>${escapeHTML(alert.duration || 'N/A')}</td>
            <td>${escapeHTML(alert.component || 'N/A')}</td>
            <td><a href="${escapeHTML(alert.link || '#')}">View</a></td>
            <td>${escapeHTML(alert.runbook || 'N/A')}</td>
            <td>${escapeHTML(alert.service || 'N/A')}</td>
            <td>${escapeHTML(Array.from(alert.environments || []).join(', ') || 'N/A')}</td>
            <td>${escapeHTML(alert.severity || 'N/A')}</td>
            <td>${escapeHTML(alert.threshold || 'N/A')}</td>
            <td>${escapeHTML(alert.expr || 'N/A')}</td>
        </tr>
    `;
};

const getTeamInfoContent = async (teamName, teamInfoContent) => {
    if (!teamInfoContent.trim()) {
        console.warn(`Team info content is empty for ${teamName}.`);
        return `No specific information available for ${teamName}.`;
    }
    return teamInfoContent.trim();
};

const createTeamSection = async (teamName, alerts, baseDir) => {
    const teamInfoSection = await getTeamInfoContent(teamName, baseDir);
    const tableRows = alerts.map(createTableRow).join('');
    const header = createTableHeader();

    const teamContent = `
        <h1>${teamName} Team Alerts</h1>
        ${teamInfoSection}
        <div style="overflow-x: auto;">
            <table class="confluenceTable" style="width: 100%; border-collapse: collapse; border: 1px solid #ccc;">
                <thead>${header}</thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
    `;

    return teamContent;
};

const formatAlertsHTML = async (groupedAlerts, baseDir) => {
    let content = `<p>Last Updated: ${new Date().toLocaleString()}</p>`;
    for (const [team, alerts] of Object.entries(groupedAlerts)) {
        content += await createTeamSection(team, alerts, baseDir);
    }
    return content;
};

// ----------------------------- AWS Secrets Manager -----------------------------

const getSecret = async (secretName) => {
    try {
        const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
        if ('SecretString' in data) {
            return JSON.parse(data.SecretString);
        }
        throw new Error('Secret binary not supported');
    } catch (error) {
        console.error(`Error retrieving secret: ${error}`);
        throw error;
    }
};

// ----------------------------- Lambda Handler -----------------------------

exports.handler = async (event) => {
    const secretConfig = await getSecret('ConfSecret');

    const CONFLUENCE_URL = secretConfig.CONFLUENCE_URL;
    const CONFLUENCE_USER = secretConfig.CONFLUENCE_USER;
    const CONFLUENCE_API_TOKEN = secretConfig.CONFLUENCE_API_TOKEN;
    const CONFLUENCE_PAGE_ID = secretConfig.CONFLUENCE_PAGE_ID;
    const BUCKET_NAME = 'vxdbvxdfbdfxbdbdb';

    try {
        // Retrieve the list of files from the S3 bucket
        const params = {
            Bucket: BUCKET_NAME,
            Prefix: '', // if your files are in a specific folder
        };
        const s3Objects = await s3.listObjectsV2(params).promise();

        if (s3Objects.Contents.length === 0) {
            console.warn("No alert files found in the S3 bucket.");
            return;
        }

        let allAlerts = [];
        for (const obj of s3Objects.Contents) {
            const key = obj.Key;
            if (key.endsWith('.yml') || key.endsWith('.yaml')) {
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
        throw error; // Rethrow error to mark Lambda as failed
    }
};
