module.exports = {
    pinLastUpdateForStableTest: (ord, lastUpdate = "2026-05-04T13:45:01+01:00") => {
        [
            ...(ord.apiResources || []), //
            ...(ord.eventResources || []), //
            ...(ord.consumptionBundles || []), //
        ].forEach((element) => {
            element.lastUpdate = lastUpdate;
        });

        return ord;
    },
};
