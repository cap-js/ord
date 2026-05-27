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

function slice(document, limit, chunk = 100) {
    if (getFileSizeInBytes(document) < limit) {
        return [document];
    }

    const slices = [];
    const ord = Object.fromEntries(
        Object.entries(document) //
            .filter(([key, value]) => ordMainPartKeys.includes(key) || !Array.isArray(value) || !value.length),
    );

    let slice = { ...ord };
    let sliceSize = getFileSizeInBytes(slice);

    Object.entries(document)
        .filter(([key]) => !(key in ord))
        .forEach(([key, value]) => {
            let start = 0;

            for (let i = 0; i < value.length; i += chunk) {
                const remaining = limit - sliceSize;
                const additional = getFileSizeInBytes({
                    [key]: value.slice(start, i + chunk),
                });

                if (remaining < additional) {
                    slices.push(Object.assign(slice, { [key]: value.slice(start, i) }));

                    // prepare for the next slice
                    start = i;
                    slice = { ...ord };
                    sliceSize = getFileSizeInBytes(slice);
                }
            }

            slice = Object.assign(slice, { [key]: value.slice(start) });
            sliceSize = getFileSizeInBytes(slice);
        });

    slices.push(slice);

    return slices;
}

module.exports = {
    slice,
};
