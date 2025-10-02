const localize = require("@sap/cds/lib/i18n/localize");


// turn effective CSN into interop CSN
function interopCSN(csn) {
  add_i18n_texts(csn)
  map_annotations(csn)
  add_meta_info(csn)
  return csn;
}


//
// add i18n texts
//
// First fetch all texts defnied in the app,
// then remove those that are not referenced in the csn.
//
function add_i18n_texts(csn) {

  // get all texts of the app
  const i18n = [...(localize.bundles4(csn) || [])]
   .filter(([locale, _value]) => !!locale)
   .reduce((all, [locale, value]) => ({ ...all, [locale]: value }), {});

  // get all i18n keys referenced in the csn
  let i18n_keys = new Set();
  for (let n1 in csn.definitions) {
    let def = csn.definitions[n1];
    collect_i18n(def, i18n_keys);
    if (def.kind === "entity")
      for (let n2 in def.elements) {
        let el = def.elements[n2];
        collect_i18n(el, i18n_keys);
      }
  }

  // delete from i18n array all entries not occuring in i18n_keys and add result to csn
  for (let locale in i18n) {
    let texts = i18n[locale];
    for (let k in texts) {
      if (!i18n_keys.has(k)) delete texts[k];
    }
    if (Object.keys(texts).length === 0) delete i18n[locale];
  }
  csn["i18n"] = i18n;

  // helper function: find all i18n keys referenced in annotations
  // for an entity or element
  // to be improved: currently only considers annotations with scalar, string-like value;
  //                 doesn't drill into structured or array-like annotations
  function collect_i18n(o, keys) {
    for (let n in o) {
      if (n.startsWith("@")) {
        let annoVal = o[n];
        if (typeof annoVal === "string" && annoVal.startsWith("{i18n>")) {
          let [,x] = annoVal.match(/^\{i18n>(.*)\}$/) || [];
          if (x) keys.add(x);
        }
      }
    }
  }
}


//
// annotation mapping/replacement
//
function map_annotations(csn) {

  for (let n1 in csn.definitions) {
    let def = csn.definitions[n1];
    replaceAnnos(def);
    if (def.kind === "entity")
      for (let n2 in def.elements) {
        let el = def.elements[n2];
        replaceAnnos(el);
      }
  }

  // helper function: do the actual anno replacement
  function replaceAnnos(o) {
    // rhs null => anno is removed
    const annoReplacement = {
      "@Common.Label": "@EndUserText.label",
      "@title":        "@EndUserText.label",
      "@label":        "@EndUserText.label",
      "@description":  "@EndUserText.quickInfo",
      "@cds.autoexpose": null
    };

    for (const [oldA, newA] of Object.entries(annoReplacement)) {
      if (o[oldA]) {
        if (newA) o[newA] ??= o[oldA];
        delete o[oldA];
      }
    }
  }
}


//
// add meta information
//
function add_meta_info(csn) {
  if (typeof csn != 'object') return csn;  // needed to make tests pass
  csn["csnInteropEffective"] = "1.0";
  csn.meta ??= {};
  csn.meta.flavor = "effective";

  let services = Object.entries(csn.definitions).filter( ([, def]) => def.kind === 'service');
  if (services.length === 1) {
    // assumption: "short" service name contains no dots
    let segments = services[0][0].split('.')
    let v = '1'
    let srv = segments.pop()
    let m = srv.match(/^v(\d+)$/)
    if (m) {
      srv = segments.pop();
      v = m[1]
    }
    csn.meta.document = { version: `${v}.0.0`}
    csn.meta.__name = srv
    if (segments.length>0) csn.meta.__namespace = segments.join('.')
  }

  return csn;
}


module.exports = {
    interopCSN
};
