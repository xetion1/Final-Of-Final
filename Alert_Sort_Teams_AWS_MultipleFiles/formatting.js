const { escapeHTML } = require('./utils');
const { getTeamInfoContent } = require('./teamInfo');

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

module.exports = {
    formatAlertsHTML
};
