const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const pluginPath = path.join(__dirname, ".claude-plugin", "plugin.json");
const plugin = JSON.parse(fs.readFileSync(pluginPath, "utf8"));

const [major, minor, patch] = plugin.version.split(".").map(Number);
plugin.version = `${major}.${minor}.${patch + 1}`;

fs.writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");

console.log(`Bumped version to ${plugin.version}`);

execFileSync("git", ["add", "-A"], { stdio: "inherit" });
execFileSync("git", ["commit", "-m", `v${plugin.version}`], { stdio: "inherit" });
execFileSync("git", ["push"], { stdio: "inherit" });

console.log(`Published v${plugin.version}`);
