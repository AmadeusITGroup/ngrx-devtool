const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const pkgPath = path.join(__dirname, "package.json");
const distPkgPath = path.join(__dirname, "dist", "package.json");

const source = fs.readFileSync(pkgPath, "utf-8");
const sourceObj = JSON.parse(source);

// Remove fields that block or are unnecessary for publishing
delete sourceObj.private;
sourceObj.scripts = {};
sourceObj.devDependencies = {};

// Only keep runtime deps needed by the CLI server (index.js)
const runtimeDeps = ["ws", "express", "tslib", "chalk"];
const cleanedDeps = {};
for (const dep of runtimeDeps) {
  if (sourceObj.dependencies && sourceObj.dependencies[dep]) {
    cleanedDeps[dep] = sourceObj.dependencies[dep];
  }
}
sourceObj.dependencies = cleanedDeps;

if (sourceObj.exports && sourceObj.exports["."] && sourceObj.exports["."].startsWith("./dist")) {
  sourceObj.exports["."] = "./" + sourceObj.exports["."].slice(7);
}

if (sourceObj.bin && sourceObj.bin["ngrx-devtool"] && sourceObj.bin["ngrx-devtool"].startsWith("./dist")) {
  sourceObj.bin["ngrx-devtool"] = "./" + sourceObj.bin["ngrx-devtool"].slice(7);
}

fs.writeFileSync(distPkgPath, JSON.stringify(sourceObj, null, 2), "utf-8");

// Remove demo app from dist if present
const demoPath = path.join(__dirname, "dist", "ngrx-devtool-demo");
if (fs.existsSync(demoPath)) {
  fs.rmSync(demoPath, { recursive: true, force: true });
}

const readmeSrc = path.join(__dirname, "npm-readme.md");
const readmeDest = path.join(__dirname, "dist", "README.md");
if (fs.existsSync(readmeSrc)) {
  fs.copyFileSync(readmeSrc, readmeDest);
}

try {
  execSync(`npx prettier --write "${distPkgPath}"`, { stdio: "inherit" });
} catch (e) {
  console.warn("Prettier not found or failed to format dist/package.json");
}
