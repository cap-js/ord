import { createRequire } from "module";
const require = createRequire(import.meta.url);
const cjs = require("./index.js");

// re-export named properties for ESM consumers
export const ord = cjs.ord || cjs;
export const defaults = cjs.defaults;
export const getMetadata = cjs.getMetadata || cjs.metaData;
export const Logger = cjs.Logger;
export const constants = cjs.constants;
export const authentication = cjs.authentication;

export default cjs;
