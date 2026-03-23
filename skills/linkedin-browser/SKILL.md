---
name: linkedin-browser
description: DOM selectors, timing, JS patterns, and gotchas for LinkedIn browser automation
---

# LinkedIn Browser Automation Reference

Field-tested patterns and gotchas for automating LinkedIn via browser automation tools.

## Browser Setup

- **Headed only.** LinkedIn detects and blocks headless browsers. Always launch with `headless: false` (or equivalent). Headless mode will not work.
- **Connect to the user's existing browser** instead of launching a new instance. This reuses their active LinkedIn session, avoiding login flows and reducing detection risk. Use CDP (Chrome DevTools Protocol) to attach to a browser the user already has open — e.g. `--remote-debugging-port=9222`.

## DOM & Selectors

### Stable selectors

- `a[href*="/in/"]` — profile links. The most reliable selector on LinkedIn search results. Class names like `entity-result__title-text` change frequently.
- `document.querySelectorAll('button')` filtered by `innerText` — buttons. More stable than class-based selectors.
- Accessibility tree / snapshot refs (e.g. `@e20`) — the most reliable way to target elements. Always prefer these over coordinates.

### Unreliable approaches

- **Coordinate-based clicking** — LinkedIn's DOM is heavily layered with overlapping elements. Coordinates hit the wrong thing.
- **CSS class selectors** — LinkedIn renames classes (`reusable-search__result-container`, `entity-result__*`) across deploys. Don't depend on them.

### Hidden elements

- **Connect, Message, Follow** buttons are often hidden behind the **"More actions"** / **"More"** dropdown. Always check there before concluding a button doesn't exist.
- The connection degree badge (`• 1st`, `• 2nd`) appears in link text on search result cards, not as a separate element.

## JavaScript Evaluation

### Quoting

Inline JS with quotes (single or double) gets mangled by shell escaping when passed to browser automation CLIs. **Write JS to a temp file first:**

```bash
cat > /tmp/extract.js << 'JSEOF'
JSON.stringify(
  Array.from(document.querySelectorAll('a[href*="/in/"]'))
    .map(a => ({ text: a.textContent.trim().substring(0, 200), url: a.href.split('?')[0] }))
    .filter(a => a.url.includes('/in/') && !a.url.includes('{target_slug}'))
    .reduce((acc, a) => { if (!acc.some(x => x.url === a.url)) acc.push(a); return acc; }, [])
)
JSEOF
```

Then evaluate the file contents in the browser context using whatever tool is available.

This temp-file pattern works reliably regardless of the automation tool's quoting rules.

### Useful extraction patterns

**Profile URLs from search results:**
```javascript
Array.from(document.querySelectorAll('a[href*="/in/"]'))
  .map(a => ({ text: a.textContent.trim(), url: a.href.split('?')[0] }))
  .filter(a => a.url.includes('/in/'))
  .reduce((acc, a) => { if (!acc.some(x => x.url === a.url)) acc.push(a); return acc; }, [])
```

The link text on search result cards contains name, degree, title, location, and mutual connection names all concatenated. Parse with string splitting rather than relying on child element selectors.

## Connection Requests

### Send flow (confirmed working)

1. Navigate to profile
2. Detect profile state — look for Connect, Pending, or Message buttons
3. Click "Connect" (or find it under "More actions")
4. Wait 2s for modal to appear
5. Click "Add a note"
6. Wait 1s, then type the message into the textarea
7. Verify message and Send button state
8. Click "Send invitation"

### `fill` vs `type` on the connection note modal

- **Do NOT use `fill`** (or equivalent set-value methods) on the connection note textarea. It causes the modal to dismiss unexpectedly — the note appears entered but the modal disappears.
- **Use keystroke-based typing** (`type`, `keyboard.type`, etc.) instead. This keeps the modal open and enables the Send button correctly.
- `fill` works fine on other LinkedIn fields (e.g., the messaging panel compose box). The issue is specific to the "Add a note" modal.

### Character limit

LinkedIn caps connection notes at **300 characters**. Truncate to 297 + "..." if needed.

## Pagination

### "Frame was detached" on page clicks

Clicking pagination buttons on LinkedIn search results can trigger "Frame was detached" errors, killing the browser connection entirely.

**Detection:** After clicking a page button, if `snapshot` returns empty or errors with "Target page, context or browser has been closed", the frame was detached.

**Recovery:**
1. Re-open any URL to re-establish the connection
2. Re-navigate to the profile
3. Re-click mutual connections
4. Re-apply any filters (e.g., 2nd degree)
5. Jump directly to the page you were on

### Pagination structure

- Page buttons appear as `Page 1`, `Page 2`, etc. plus a `Next` button
- 10 results per page
- When `Next` is absent, you're on the last page
- Adding degree filters (e.g., 2nd degree) can increase the total page count

## Timing & Rate Limits

- **2-4 seconds** between major actions (page loads, filter changes, button clicks)
- **4 seconds** between processing separate profiles (outreach)
- If you encounter a **CAPTCHA**, **login wall**, or **rate limit warning** — stop everything immediately and alert the user
- LinkedIn actively monitors for automation. Slower is safer.

## Search Results (Mutual Connections)

- The "mutual connections" link on a profile (e.g., "Sammy Abdullah and 16 other mutual connections") opens a filtered search
- Default filter: 1st degree only. Click the "2nd" checkbox to add 2nd degree connections
- Both filters can be active simultaneously (1st checked + 2nd checked)
- Results include: name, degree, title, location, and names of shared mutual connections
- The degree shown (1st/2nd) is YOUR relationship to that person, not the target's
