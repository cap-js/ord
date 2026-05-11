function validate(document) {
    const errors = [];
    const seenOrdIds = new Set();

    const allResources = [
        ...(document.resolved.apiResources || []),
        ...(document.resolved.eventResources || []),
        ...(document.resolved.entityTypes || []),
        ...(document.resolved.integrationDependencies || []),
    ];

    for (const resource of allResources) {
        if (!resource.ordId) continue;

        if (seenOrdIds.has(resource.ordId)) {
            errors.push(`Duplicate ordId: "${resource.ordId}"`);
        }
        seenOrdIds.add(resource.ordId);
    }

    if (errors.length) {
        throw new Error(`ORD validation failed:\n  ${errors.join("\n  ")}`);
    }
}

module.exports = { validate };
