import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';
import { extractThresholdFromExpr } from './utils.js';

export const fetchAlertsData = async (fileName, dirPath) => {
    const filePath = path.join(dirPath, fileName);
    console.log(`Reading data from file: ${filePath}`);
    try {
        const fileContents = await fs.readFile(filePath, 'utf8');
        const data = yaml.load(fileContents);
        return processAlertData(data);
    } catch (error) {
        console.error(`Error reading file (${fileName}): ${error}`);
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

export const groupAlertsByTeam = (alertsData) => {
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
