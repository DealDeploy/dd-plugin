---
name: check-mutual-connections
description: >
  Scrape all mutual 1st and 2nd degree LinkedIn connections between the logged-in user
  and a target profile, then post structured results to #linkedin-leads in Slack as a
  threaded message under a daily "High Priority Leads" header. Uses a headless Chrome
  MCP server so it runs in the background without interrupting the user's browser.
  Use this skill whenever the user mentions checking mutual connections, finding shared
  LinkedIn contacts, seeing who they know in common with someone, or any variation of
  "check mutuals with [person]". Also triggers when the HubSpot task runner encounters
  a task that requires mutual connection lookups. Always posts output to Slack, never
  just chat.
compatibility: linkedin-headless-mcp (headless Chrome via CDP), Slack MCP for posting results, HubSpot MCP for company/contact data when called from task runner
---

# Check Mutual Connections (Headless)

Given a LinkedIn URL and target name, scrape all mutual 1st and 2nd degree connections using a headless Chrome browser, then post results to the #linkedin-leads Slack channel as a threaded reply under a daily date header.

**This skill runs in the background.** It uses the `linkedin-headless-mcp` server (headless Chrome via Puppeteer) instead of the Claude in Chrome extension. The user's visible browser is not touched.

## Inputs

1. **LinkedIn URL** — target's profile URL (e.g. `https://www.linkedin.com/in/joshsokol`)
2. **Target name** — the person's name (e.g. "Josh Sokol")
3. **Company name** — the company they work at (e.g. "Acme Corp")
4. **Company website** — URL of their company (e.g. `https://acmecorp.com`)

If company name/website are not provided:
- When called from the HubSpot task runner, look up the associated company record in HubSpot for name and domain.
- When called directly, extract the company from the target's LinkedIn profile after navigating to it.

If any required input (LinkedIn URL or target name) is missing, ask the user before proceeding.

## Step 1: Verify Login

Before anything else, call `check_login_status` on the headless Chrome MCP to confirm LinkedIn is accessible.

If not logged in, stop and tell the user: "The headless Chrome browser is not logged into LinkedIn. Please ensure your Chrome profile has an active LinkedIn session, then try again."

Extract the **logged-in user's name** from the response. Store this for the final output header.

## Step 2: Navigate to the Profile

Use `navigate` to open the target's LinkedIn profile URL.

Use `get_page_content` (mode: "title_and_url") to confirm the page loaded correctly.

If the page shows a login wall or error, stop and tell the user.

## Step 3: Open Mutual Connections

Use `execute_javascript` to find and click the mutual connections link:

```javascript
const mutualLink = document.querySelector('a[href*="connectionOf"]');
if (mutualLink) { mutualLink.click(); 'clicked'; } else { 'not_found'; }
```

If not found, try looking for text containing "mutual connection" and clicking that element.

Wait 3 seconds for the search results page to load.

## Step 4: Enable 2nd-Degree Filter FIRST

**Important: Enable 2nd degree before extracting any results.** This lets you collect all connections (1st and 2nd) in a single pass.

Use `execute_javascript` to find and click the 2nd-degree filter. On LinkedIn, filters are `<label>` elements, not buttons:

```javascript
const labels = Array.from(document.querySelectorAll('label'));
const secondDeg = labels.find(l => l.textContent.trim().includes('2nd'));
if (secondDeg) { secondDeg.click(); 'clicked 2nd degree filter'; } else { 'filter not found'; }
```

Wait 3 seconds for results to reload.

**Why this order matters:** The default shows only 1st degree. Adding 2nd degree upfront avoids duplicate work from reshuffled pagination.

## Step 5: Extract Connections (Max 10 Pages)

**Pagination cap: 10 pages maximum.** LinkedIn sorts mutual connections by relevance (1st degree first, then 2nd degree by closeness/shared mutuals). The first 10 pages capture all high-value connections. Going deeper adds volume without signal and increases automation risk.

For each page, use `execute_javascript` to extract connections:

```javascript
// Initialize storage on first run
if (!window._allConnections) window._allConnections = [];

const seen = new Set(window._allConnections.map(c => c.url));
document.querySelectorAll('a[href*="/in/"]').forEach(a => {
  const url = a.href.split('?')[0];
  if (url.includes('{target_slug}') || seen.has(url)) return;
  const text = a.textContent.trim();
  if (!text.includes('1st') && !text.includes('2nd')) return;
  const degree = text.includes('2nd') ? '2nd' : '1st';
  const namePart = text.split(/\s*•\s*/)[0].trim();
  const parts = text.split(/(?:1st|2nd)/);
  let title = '';
  if (parts[1]) {
    const lines = parts[1].split('\n').map(l => l.trim()).filter(l =>
      l.length > 5 && !l.includes('Connect') && !l.includes('mutual') &&
      !l.includes('Message') && !l.includes('follower')
    );
    title = lines[0] || '';
  }
  seen.add(url);
  window._allConnections.push({ name: namePart, url, degree, title: title.substring(0, 100) });
});

// Check for Next button
const nextBtn = Array.from(document.querySelectorAll('button')).find(
  b => b.textContent.trim() === 'Next' || b.getAttribute('aria-label') === 'Next'
);
const currentPage = document.querySelector('button[aria-current="true"]');
const pageNum = currentPage ? parseInt(currentPage.textContent.trim()) : 0;

JSON.stringify({
  total: window._allConnections.length,
  first: window._allConnections.filter(c => c.degree === '1st').length,
  second: window._allConnections.filter(c => c.degree === '2nd').length,
  hasNext: !!nextBtn,
  page: pageNum
});
```

## Step 6: Paginate (Up to Page 10)

After extracting from the current page:

1. Check `hasNext` and `page` from the result.
2. If `hasNext` is true AND `page < 10`, click Next via JavaScript:
   ```javascript
   const nextBtn = Array.from(document.querySelectorAll('button')).find(
     b => b.textContent.trim() === 'Next' || b.getAttribute('aria-label') === 'Next'
   );
   if (nextBtn) nextBtn.click();
   ```
3. Use `wait` for 2500ms.
4. Repeat Step 5.

If `page >= 10` or `hasNext` is false, stop paginating and move to Step 7.

## Step 7: Collect Final Results

Use `execute_javascript` to retrieve all collected connections:

```javascript
JSON.stringify(window._allConnections);
```

If the result is large, retrieve in chunks (first 80, then remaining).

Deduplicate by LinkedIn URL. Sort: 1st degree first, then 2nd, alphabetical within each group.

## Step 8: Post to Slack

Post results to the **#linkedin-leads** channel (ID: `C08CB4WA51P`).

### 8a: Find or Create Daily Parent Message

Search for today's parent message:

```
slack_search_public_and_private(
  query: "\"High Priority Leads for {formatted_date}\" in:#linkedin-leads on:{YYYY-MM-DD}"
)
```

Where `{formatted_date}` is like "April 29, 2026" and `{YYYY-MM-DD}` is "2026-04-29".

- If found, use its `ts` as `thread_ts` for the reply.
- If not found, create it:
  ```
  slack_send_message(
    channel_id: "C08CB4WA51P",
    message: "**High Priority Leads for {formatted_date}**"
  )
  ```
  Use the returned `message_ts` as `thread_ts`.

### 8b: Post Company Reply as Thread

Post a threaded reply with this format:

```
**{Company Name}**
{company_website_url}

**Key Contact:** <{contact_linkedin_url}|{Contact Name}> — {Title}

**Mutual Connections ({count} found):**

_1st Degree_
• <{url}|{Name}> — {Title}
• <{url}|{Name}> — {Title}

_2nd Degree_
• <{url}|{Name}> — {Title}
• <{url}|{Name}> — {Title}
...
```

Use `slack_send_message` with `thread_ts` set to the parent message's timestamp.

**Rules:**
- Each company is a separate threaded reply (one reply per skill invocation)
- Include LinkedIn URLs for every connection
- List all 1st degree connections
- For 2nd degree, list up to ~50 with a note like "...and {N} more 2nd degree connections" if the list exceeds message limits
- Keep messages under ~4000 chars; split into multiple threaded replies if needed
- Company/website info comes from HubSpot when called by task runner, falls back to LinkedIn profile data

### 8c: Confirm in Chat

After posting to Slack, provide a brief confirmation in chat:

```
Posted to #linkedin-leads — {count} mutual connections for {Target Name} at {Company}.
({first_count} 1st degree, {second_count} 2nd degree)
```

Do NOT repeat the full connection list in chat. The Slack message is the primary output.

## Step 9: Clean Up

Call `close_browser` to shut down the headless Chrome instance and free resources.

## Error Handling

- **Not logged in** — stop, tell user to ensure Chrome profile has active LinkedIn session
- **Login wall on profile** — stop, inform user
- **No mutual connections link** — target may have restricted visibility, inform user
- **Empty results** — report "No mutual connections found"
- **Rate limit / CAPTCHA** — stop immediately, close browser, alert user
- **Headless Chrome launch failure** — check that Chrome is installed and profile path is correct
- **Cookie copy failure** — ensure Chrome is not running (profile lock), or use CHROME_PROFILE_PATH env var

## MCP Tool Reference

This skill uses tools from the `linkedin-headless-mcp` server:

| Skill Step | MCP Tool | Purpose |
|---|---|---|
| Verify login | `check_login_status` | Confirm LinkedIn session is active |
| Navigate | `navigate` | Go to profile URL |
| Extract data | `execute_javascript` | Run JS to scrape connections |
| Paginate | `execute_javascript` | Click Next button via JS |
| Wait | `wait` | Pause between pages |
| Verify state | `get_page_content` | Check page loaded correctly |
| Debug | `screenshot` | Capture page state if something fails |
| Clean up | `close_browser` | Shut down headless Chrome |

Slack posting uses the standard Slack MCP tools (`slack_send_message`, `slack_search_public_and_private`).
