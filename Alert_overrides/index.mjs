// Import required libraries
import AWS from 'aws-sdk';
import yaml from 'js-yaml';
import axios from 'axios';

// Initialize AWS S3 and Secrets Manager
const s3 = new AWS.S3();
const secretsManager = new AWS.SecretsManager();

// Function to retrieve secrets from AWS Secrets Manager
async function getSecretValue(secretName) {
    try {
        const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
        if ('SecretString' in data) {
            return JSON.parse(data.SecretString);
        }
        throw new Error('Secret string is empty');
    } catch (err) {
        console.error(`Error retrieving secret ${secretName}: ${err}`);
        throw err;
    }
}

// Function to retrieve alerts configuration from S3
const getAlertsConfigFromS3 = async (bucket, fileKey) => {
    try {
        const params = {
            Bucket: bucket,
            Key: fileKey,
        };
        const data = await s3.getObject(params).promise();
        const loadedData = yaml.load(data.Body.toString('utf-8'));
        console.log("Loaded data from YAML:", loadedData);  // Log the raw loaded data
        return loadedData;  // Directly return the loaded data
    } catch (err) {
        console.error(`Error retrieving alerts configuration from S3: ${err}`);
        throw err;
    }
};

// Function to extract disabled alerts
const extractDisabledAlerts = (config) => {
    const disabledAlerts = [];
    
    // Extract disabled alerts from alert_overrides
    if (config.alert_overrides) {
        config.alert_overrides.forEach(alert => {
            if (alert.enabled === 'no') {
                disabledAlerts.push(alert.alertname);
            }
        });
    }

    // Extract disabled groups from group_overrides (optional)
    if (config.group_overrides) {
        config.group_overrides.forEach(group => {
            if (group.enabled === 'no') {
                disabledAlerts.push(`Group: ${group.groupname}`);
            }
        });
    }

    return disabledAlerts;
};

// Function to retrieve and process alerts configuration for all environments
// Function to retrieve and process alerts configuration for all environments
const processAllEnvironments = async (bucketName, fileKeys) => {
    let alertEnvironmentMap = {};
    let groupEnvironmentMap = {};

    for (const fileKey of fileKeys) {
        const environment = fileKey.split('-')[0].toUpperCase(); // Extracts and converts 'env1' to 'ENV1'
        const alertsConfig = await getAlertsConfigFromS3(bucketName, fileKey);

        // Process alerts
        if (alertsConfig.alert_overrides) {
            alertsConfig.alert_overrides.forEach(alert => {
                if (alert.enabled === 'no') {
                    if (!alertEnvironmentMap[alert.alertname]) {
                        alertEnvironmentMap[alert.alertname] = [];
                    }
                    alertEnvironmentMap[alert.alertname].push(environment);
                }
            });
        }

        // Process groups
        if (alertsConfig.group_overrides) {
            alertsConfig.group_overrides.forEach(group => {
                if (group.enabled === 'no') {
                    if (!groupEnvironmentMap[group.groupname]) {
                        groupEnvironmentMap[group.groupname] = [];
                    }
                    groupEnvironmentMap[group.groupname].push(environment);
                }
            });
        }
    }

    return { alertEnvironmentMap, groupEnvironmentMap };
};

// Function to format the combined data into a single Confluence table
const formatForConfluenceTable = (dataMap, title) => {
    let confluenceTable = `<h2>${title}</h2><table><tbody>`;
    confluenceTable += '<tr><th>Name</th><th>Disabled Environments</th></tr>';

    for (const [name, environments] of Object.entries(dataMap)) {
        const formattedEnvironments = environments.join(', '); // Join all environments for the name into a single string
        confluenceTable += `<tr><td>${name}</td><td>${formattedEnvironments}</td></tr>`;
    }

    confluenceTable += '</tbody></table>';
    return confluenceTable;
};

// Function to import formatted data to Confluence
const importToConfluence = async (formattedData, confluenceDetails) => {
    const url = `${confluenceDetails.CONFLUENCE_URL}/wiki/rest/api/content/${confluenceDetails.CONFLUENCE_PAGE_ID}`;
    const auth = {
        username: confluenceDetails.CONFLUENCE_USER,
        password: confluenceDetails.CONFLUENCE_API_TOKEN
    };

    try {
        const getPageResponse = await axios.get(url, { auth });
        const currentVersion = getPageResponse.data.version.number;

        const updateData = {
            version: { number: currentVersion + 1 },
            title: getPageResponse.data.title,
            type: 'page',
            body: {
                storage: {
                    value: formattedData,
                    representation: 'storage'
                }
            }
        };

        const updateResponse = await axios.put(url, updateData, {
            headers: { 'Content-Type': 'application/json' },
            auth
        });
        console.log(`Data successfully imported to Confluence: ${updateResponse.status}`);
    } catch (err) {
        console.error(`Failed to import data to Confluence: ${err}`);
        throw err;
    }
};

// Export the handler function for AWS Lambda
export async function handler(event) {
    const bucketName = 'fsdgvxdcvbxbxbvac'; // Replace with your actual bucket name
    const fileKeys = ['env1-overrides.yml', 'env2-overrides.yml', 'env3-overrides.yml', 'env4-overrides.yml']; // The keys for your files in S3

    try {
        const { alertEnvironmentMap, groupEnvironmentMap } = await processAllEnvironments(bucketName, fileKeys);

        const alertsTable = formatForConfluenceTable(alertEnvironmentMap, "Disabled Alerts");
        const groupsTable = formatForConfluenceTable(groupEnvironmentMap, "Disabled Alert Groups");
        const combinedTables = alertsTable + groupsTable; // Combine both tables into one string for importing

        const secretName = 'CONFLUENCE_API';  // The name of your secret in AWS Secrets Manager
        const confluenceDetails = await getSecretValue(secretName);

        console.log("Formatted table for Confluence:", combinedTables); // Log the formatted tables for Confluence

        await importToConfluence(combinedTables, confluenceDetails);
    } catch (err) {
        console.error(`Error in Lambda execution: ${err}`);
    }
};
