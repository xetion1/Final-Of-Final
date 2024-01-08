const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const secretsManager = new AWS.SecretsManager();

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

module.exports = {
    s3,
    secretsManager,
    getSecret
};
