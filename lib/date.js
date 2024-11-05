function getRFC3339Date(includeOffset = true) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    
    if (includeOffset) {
        const offsetHours = '01';
        const offsetMinutes = '00';
        const offsetSign = '+';
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
    } else {
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
    }
}

module.exports = {
    getRFC3339Date
};
