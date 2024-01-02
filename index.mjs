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

// Function to retrieve alerts from S3
const getAlertsFromS3 = async (bucket, fileKey) => {
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
        console.error(`Error retrieving alerts from S3: ${err}`);
        throw err;
    }
};

// Function to format alerts data for Confluence
// Function to format alerts data for Confluence
const formatForConfluence = (alertsData) => {
    let confluenceTable = '<table style="max-width: 1000px; width: 100%;" ><tbody><tr>'; // Set the max-width here

    // Headers should match the expected keys in the alertsData objects
    const headers = [
        "Alert Name", "Service", "Threshold", "Level", 
        "Impacted Functionality", "Meaning", "Runbook", 
        "Fix of Issue", "Playbook", "Playbook Ticket", "Creator"
    ];
    headers.forEach(header => {
        confluenceTable += `<th>${header}</th>`;
    });
    confluenceTable += '</tr>';

    alertsData.forEach(alert => {
        confluenceTable += '<tr>';
        headers.forEach(header => {
            if(header === "Threshold") {
                // Modify this section to format the Threshold cell as a red info panel
                confluenceTable += `<td><ac:structured-macro ac:name="warning"><ac:rich-text-body><p>${alert[header] || ''}</p></ac:rich-text-body></ac:structured-macro></td>`;
            } else {
                confluenceTable += `<td>${alert[header] || ''}</td>`;
            }
        });
        confluenceTable += '</tr>';
    });

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
    const bucketName = 'fsdgvxdcvbxbxbvac';  // Replace with your actual bucket name
    const fileKey = 'alerts.yaml';  // Replace with your actual file key

    try {
        const secretName = 'CONFLUENCE_API';  // The name of your secret in AWS Secrets Manager
        const confluenceDetails = await getSecretValue(secretName);

        const alertsData = await getAlertsFromS3(bucketName, fileKey);
        console.log("Alerts data after loading:", alertsData);  // Log the alerts data after loading

        if (!Array.isArray(alertsData)) {
            console.error("Received data is not an array", alertsData);
            throw new Error("Expected alertsData to be an array");
        }

        const formattedData = formatForConfluence(alertsData);
        await importToConfluence(formattedData, confluenceDetails);
    } catch (err) {
        console.error(`Error in Lambda execution: ${err}`);
    }
};
