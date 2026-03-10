/**
 * Public API entry point for @cap-js/ord library
 * Exposes core functionality for ORD document generation and metadata retrieval
 *
 * @example
 * const { ord, getMetadata } = require('@cap-js/ord/lib');
 */
module.exports = {
    ord: require("./core/ord.js"),
    getMetadata: require("./core/compile-metadata.js"),
};
