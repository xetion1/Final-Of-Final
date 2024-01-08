const getTeamInfoContent = async (teamName, teamInfoContent) => {
    if (!teamInfoContent.trim()) {
        console.warn(`Team info content is empty for ${teamName}.`);
        return `No specific information available for ${teamName}.`;
    }
    return teamInfoContent.trim();
};

module.exports = {
    getTeamInfoContent
};
