module.exports = {
    replace: (value, context) => {
        return Object.entries(context) //
            .reduce((result, [key, value]) => result?.replaceAll(`{${key}}`, value), value);
    },
};
