// Copies package.json's version into skill/brainiverse/VERSION, so installs made with
// `npx skills add` (which copy only the skill folder) know their version too.
// Runs automatically on `npm version` (see package.json scripts).
import fs from "node:fs";

const { version } = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
fs.writeFileSync(new URL("../skill/brainiverse/VERSION", import.meta.url), version + "\n");
console.log(`skill/brainiverse/VERSION → ${version}`);
