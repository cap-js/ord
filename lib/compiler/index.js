const { parse } = require("./parse");
const { resolve } = require("./resolve");
const { validate } = require("./validate");
const { emit } = require("./emit");

function compile(csn, extensions = []) {
    const document = parse(csn, extensions);
    const resolved = resolve(document);
    validate(resolved);
    return emit(resolved);
}

module.exports = { compile, parse, resolve, validate, emit };
