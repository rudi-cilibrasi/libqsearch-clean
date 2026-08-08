import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const schemaUrl = new URL("../public/schemas/clustering-experiment-v1.schema.json", import.meta.url);
const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
const expectedId = "https://raw.githubusercontent.com/rudi-cilibrasi/libqsearch-clean/main/ncd-calculator/public/schemas/clustering-experiment-v1.schema.json";

if (
  schema.$schema !== "https://json-schema.org/draft/2020-12/schema"
  || schema.$id !== expectedId
  || schema.properties?.format?.const !== "complearn-clustering-experiment"
  || schema.properties?.schemaVersion?.const !== 1
  || schema.properties?.schema?.const !== expectedId
) {
  throw new Error("Clustering export schema identity does not match format version 1");
}

const definitions = schema.$defs;
if (!definitions || typeof definitions !== "object") {
  throw new Error("Clustering export schema has no definitions");
}

const visit = (value, location = "#") => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(entry, `${location}/${index}`));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/$defs/")) {
    const definitionName = value.$ref.slice("#/$defs/".length);
    if (!Object.hasOwn(definitions, definitionName)) {
      throw new Error(`Clustering export schema has an unresolved reference at ${location}: ${value.$ref}`);
    }
  }
  Object.entries(value).forEach(([key, entry]) => visit(entry, `${location}/${key}`));
};
visit(schema);

for (const requiredDefinition of ["inputObject", "distanceAnalysis", "quartetTree", "searchSummary"]) {
  if (!Object.hasOwn(definitions, requiredDefinition)) {
    throw new Error(`Clustering export schema is missing ${requiredDefinition}`);
  }
}

console.log(`Verified clustering export schema: ${fileURLToPath(schemaUrl)}`);
