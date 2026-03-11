function pad(value, length = 2, symbol = "0") {
    return String(value).padStart(length, symbol);
}

function getRFC3339Date(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+01:00`;
}

module.exports = {
    getRFC3339Date,
};
