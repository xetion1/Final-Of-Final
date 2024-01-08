import fs from 'fs/promises';
import path from 'path';

export const fetchTeamInfo = async (teamName, dirPath) => {
    const fileName = `${teamName}_info.txt`;
    const filePath = path.join(dirPath, fileName);
    
    try {
        console.log(`Attempting to read file: ${filePath}`);
        const teamInfoContent = await fs.readFile(filePath, 'utf8');
        
        if (!teamInfoContent.trim()) {
            console.warn(`Team info file (${fileName}) is empty for ${teamName}.`);
            return `No specific information available for ${teamName}.`;
        }

        console.log(`Read content for ${teamName}: ${teamInfoContent}`);
        return teamInfoContent.trim();
    } catch (error) {
        console.error(`Error reading team info file (${fileName}) for ${teamName}: ${error.message}`);
        return `No specific information available for ${teamName}.`;
    }
};
