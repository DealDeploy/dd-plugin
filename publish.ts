const pluginPath = new URL(".claude-plugin/plugin.json", import.meta.url).pathname;
const marketplacePath = new URL(".claude-plugin/marketplace.json", import.meta.url).pathname;

const plugin = await Bun.file(pluginPath).json();
const marketplace = await Bun.file(marketplacePath).json();

const [major, minor, patch] = plugin.version.split(".").map(Number);
plugin.version = `${major}.${minor}.${patch + 1}`;

for (const p of marketplace.plugins) {
  if (p.name === plugin.name) {
    p.version = plugin.version;
  }
}

await Bun.write(pluginPath, JSON.stringify(plugin, null, 2) + "\n");
await Bun.write(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");

console.log(`Bumped version to ${plugin.version}`);

await Bun.$`git add -A`.quiet();
await Bun.$`git commit -m v${plugin.version}`.quiet();
await Bun.$`git tag v${plugin.version}`.quiet();
await Bun.$`git push`.quiet();
await Bun.$`git push origin v${plugin.version}`.quiet();

console.log(`Published v${plugin.version}`);
