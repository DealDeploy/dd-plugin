---
name: create-plugin
description: Scaffold a complete Claude Code plugin with marketplace, GitHub repo, and publish script. Use when the user wants to create a new plugin, set up a plugin marketplace, or scaffold a plugin for a customer.
disable-model-invocation: true
---

# Create Plugin

Scaffold a Claude Code plugin end-to-end: directory structure, manifests, GitHub repo, and publish tooling.

## Gather info

Ask the user:

1. **Plugin name** (kebab-case, e.g. `acme-tools`)
2. **Description** (one sentence)
3. **GitHub owner** (org or username to host the repo)
4. **Directory** to create the plugin in (default: `./<plugin-name>`)

## Steps

### 1. Create directory structure

```
<plugin-name>/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/
│   └── hello/
│       └── SKILL.md
├── package.json
└── publish.ts
```

### 2. Create `.claude-plugin/plugin.json`

```json
{
  "name": "<plugin-name>",
  "description": "<description>",
  "version": "1.0.0",
  "author": {
    "name": "<github-owner>"
  }
}
```

### 3. Create `.claude-plugin/marketplace.json`

```json
{
  "name": "<plugin-name>",
  "owner": {
    "name": "<github-owner>"
  },
  "metadata": {
    "description": "<description>"
  },
  "plugins": [
    {
      "name": "<plugin-name>",
      "source": "./",
      "description": "<description>",
      "version": "1.0.0"
    }
  ]
}
```

### 4. Create a starter skill

Create `skills/hello/SKILL.md`:

```markdown
---
description: Greet the user with a friendly message
disable-model-invocation: true
---

Greet the user warmly and ask how you can help them today.
```

### 5. Create publish script

Create `publish.ts` — bumps patch version in both `plugin.json` and `marketplace.json`, commits, tags, and pushes:

```ts
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
```

Create `package.json`:

```json
{
  "name": "<plugin-name>",
  "private": true,
  "scripts": {
    "publish": "bun publish.ts"
  }
}
```

### 6. Create private GitHub repo and push

```bash
git init
git add -A
git commit -m "Initial plugin scaffold"
gh repo create <github-owner>/<plugin-name> --private --description "<description>" --source . --push
```

### 7. Show the user next steps

Print this summary:

---

**Plugin created:** `<github-owner>/<plugin-name>` (private)

**To install the plugin:**

```
/plugin marketplace add <github-owner>/<plugin-name>
/plugin install <plugin-name>@<plugin-name>
```

**To grant access:** `gh repo add-collaborator <github-owner>/<plugin-name> <their-username>`

**To add skills:** create folders in `skills/` with a `SKILL.md` file.

**To publish updates:** `bun run publish`

---
