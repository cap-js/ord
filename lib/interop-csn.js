
function interopCSN(csn) {

  for (let dn in csn.definitions) {
    let def = csn.definitions[dn];
    replaceAnnos(def);
    if (def.kind === "entity")
      for (let en in def.elements) {
        let el = def.elements[en];
        replaceAnnos(el);
      }
  }

  csn["csnInteropEffective"] = "1.0";
  return csn;
}


function replaceAnnos(o) {
  const annoReplacement = {
    "@Common.Label": "@EndUserText.label",
    "@title": "@EndUserText.label",
  };

  for (const [oldA, newA] of Object.entries(annoReplacement)) {
    if (o[oldA]) {
      o[newA] ??= o[oldA];
      delete o[oldA];
    }
  }
}

module.exports = {
    interopCSN
};
