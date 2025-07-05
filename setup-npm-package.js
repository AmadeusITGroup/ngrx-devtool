const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const pkgPath = path.join(__dirname, "package.json");
const distPkgPath = path.join(__dirname, "dist", "package.json");

const source = fs.readFileSync(pkgPath, "utf-8");
const sourceObj = JSON.parse(source);

sourceObj.scripts = {};
sourceObj.devDependencies = {};

if (sourceObj.exports && sourceObj.exports["."] && sourceObj.exports["."].startsWith("./dist")) {
  sourceObj.exports["."] = "./" + sourceObj.exports["."].slice(7);
}

if (sourceObj.bin && sourceObj.bin["ngrx-devtool"] && sourceObj.bin["ngrx-devtool"].startsWith("./dist")) {
  sourceObj.bin["ngrx-devtool"] = "./" + sourceObj.bin["ngrx-devtool"].slice(7);
}

fs.writeFileSync(distPkgPath, JSON.stringify(sourceObj, null, 2), "utf-8");

try {
  execSync(`npx prettier --write "${distPkgPath}"`, { stdio: "inherit" });
} catch (e) {
  console.warn("Prettier not found or failed to format dist/package.json");
}