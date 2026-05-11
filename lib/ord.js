const { compile } = require("./compiler");

module.exports = (csn, extensions = []) => compile(csn, extensions);
