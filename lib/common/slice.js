const ordMainPartKeys = Object.freeze([
    "$schema",
    "description",
    "perspective",
    "policyLevel",
    "policyLevels",
    "customPolicyLevel",
    "describedSystemType",
    "openResourceDiscovery",
    "describedSystemVersion",
    "describedSystemInstance",
]);

function getFileSizeInBytes(document) {
    return Buffer.byteLength(JSON.stringify(document), "utf8");
}

function split(document, limit, chunk = 100) {
    if (getFileSizeInBytes(document) < limit) {
        return [document];
    }

    const slices = [];
    const ord = Object.fromEntries(
        ordMainPartKeys
            .filter((key) => key in document) //
            .map((key) => [key, document[key]]),
    );

    let slice = { ...ord };
    let sliceSize = getFileSizeInBytes(slice);

    Object.keys(document)
        .filter((key) => !ordMainPartKeys.includes(key))
        .forEach((key) => {
            let start = 0;

            for (let i = 0; i < document[key].length; i += chunk) {
                const remaining = limit - sliceSize;
                const additional = getFileSizeInBytes({
                    [key]: document[key].slice(start, i + chunk),
                });

                if (remaining < additional) {
                    slices.push(Object.assign(slice, { [key]: document[key].slice(start, i) }));

                    // prepare for the next slice
                    start = i;
                    slice = { ...ord };
                    sliceSize = getFileSizeInBytes(slice);
                }
            }

            slice = Object.assign(slice, { [key]: document[key].slice(start) });
            sliceSize = getFileSizeInBytes(slice);
        });

    slices.push(slice);

    return slices;
}

module.exports = {
    split,
};
