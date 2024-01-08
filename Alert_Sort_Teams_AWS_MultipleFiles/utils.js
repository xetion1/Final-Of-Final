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

module.exports = {
    escapeHTML,
    extractThresholdFromExpr
};
