const pluginPath = new URL(".claude-plugin/plugin.json", import.meta.url).pathname;
const plugin = await Bun.file(pluginPath).json();

const [major, minor, patch] = plugin.version.split(".").map(Number);
plugin.version = `${major}.${minor}.${patch + 1}`;

await Bun.write(pluginPath, JSON.stringify(plugin, null, 2) + "\n");

console.log(`Bumped version to ${plugin.version}`);

Bun.$`git add -A`.quiet();
Bun.$`git commit -m v${plugin.version}`.quiet();
Bun.$`git push`.quiet();

console.log(`Published v${plugin.version}`);
