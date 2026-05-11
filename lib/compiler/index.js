const { parse } = require("./parse");
const { resolve } = require("./resolve");
const { validate } = require("./validate");
const { emit } = require("./emit");

function compile(csn, extensions = []) {
    const ir = parse(csn, extensions);
    const resolved = resolve(ir);
    validate(resolved);
    return emit(resolved);
}

module.exports = { compile, parse, resolve, validate, emit };
