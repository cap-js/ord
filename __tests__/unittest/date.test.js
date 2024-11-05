const { getRFC3339Date } = require('../../lib/date');

const RFC3339_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

describe('date', () => {
    it('test getRFC3339Date', () => {
        const lastUpdate = getRFC3339Date();
        expect(lastUpdate).toMatch(RFC3339_REGEX);
    });

    it('test regex correctly', () => {
        let lastUpdate = "1985-04-12T23:20:50.52Z";
        expect(lastUpdate).toMatch(RFC3339_REGEX);

        lastUpdate = "2022-12-19T15:47:04+00:00";
        expect(lastUpdate).toMatch(RFC3339_REGEX);

        lastUpdate = "1996-12-19T16:39:57-08:00";
        expect(lastUpdate).toMatch(RFC3339_REGEX);

        lastUpdate = "1937-01-01T12:00:27.87+00:20";
        expect(lastUpdate).toMatch(RFC3339_REGEX);
    });
});
