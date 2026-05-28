const ordMainPartKeys = Object.freeze([
    "groups",
    "$schema",
    "packages",
    "products",
    "groupTypes",
    "description",
    "perspective",
    "policyLevel",
    "policyLevels",
    "customPolicyLevel",
    "consumptionBundles",
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

    let slice = {};
    let sliceSize = 2; // getFileSizeInBytes({});
    const adjustedLimit = limit - getFileSizeInBytes(ord);

    Object.entries(document)
        .filter(([key]) => !(key in ord))
        .forEach(([key, value]) => {
            let start = 0;

            for (let i = 0; i < value.length; i += chunk) {
                const remaining = adjustedLimit - sliceSize;
                const additional = getFileSizeInBytes({
                    [key]: value.slice(start, i + chunk),
                });

                if (remaining < additional) {
                    if (i > 0 || Object.keys(slice).length > 0) {
                        slices.push(Object.assign(slice, i === 0 ? {} : { [key]: value.slice(start, i) }));
                    }

                    // prepare for the next slice
                    start = i;
                    slice = {};
                    sliceSize = 2; // getFileSizeInBytes({});
                }
            }

            slice = Object.assign(slice, { [key]: value.slice(start) });
            sliceSize = getFileSizeInBytes(slice);
        });

    slices.push(slice);

    return slices.map((slice) => Object.assign(slice, ord));
}

module.exports = {
    slice,
};
