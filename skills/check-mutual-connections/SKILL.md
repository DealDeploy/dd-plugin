---
name: check-mutual-connections
description: >
  Scrape all mutual 1st and 2nd degree LinkedIn connections between the logged-in user
  and a target profile, then post structured results to #linkedin-leads in Slack as a
  threaded message under a daily "High Priority Leads" header. Tries the headless Chrome
  MCP first (background, no visible window) and automatically falls back to the visible
  Claude in Chrome browser if headless fails. Use this skill whenever the user mentions
  checking mutual connections, finding shared LinkedIn contacts, seeing who they know in
  common with someone, or any variation of "check mutuals with [person]". Also triggers
  when the HubSpot task runner encounters a task that requires mutual connection lookups
  (e.g. CLAUDE-tagged tasks with "check mutual connections" or "mutuals" in the body).
  Always posts output to Slack, never just chat.
compatibility: linkedin-headless-mcp (headless Chrome via CDP, primary), Claude in Chrome MCP (visible browser, fallback), Slack MCP for posting results, HubSpot MCP for company/contact data when called from task runner
---

# Check Mutual Connections

Given a LinkedIn URL and target name, scrape all mutual 1st and 2nd degree connections, then post results to the #linkedin-leads Slack channel as a threaded reply under a daily date header.

## Two execution paths

This skill has two browser backends and chooses automatically:

- **Headless (preferred)** — uses the `linkedin-headless-mcp` server. Runs in the background, doesn't touch the visible Chrome window, faster for the user.
- **Visible (fallback)** — uses the `Claude in Chrome` MCP. A Chrome window is visibly used. Slower / interrupts the user but more robust because LinkedIn sees their real browser fingerprint.

**Decision rule:** Always try headless first. Switch to visible if any of the following happens during the run:

1. `linkedin-headless::check_login_status` returns `logged_in: false`.
2. The headless MCP server isn't connected (tool calls error with "tool not found" or similar).
3. After navigating to the target profile, the page title contains "Sign Up" / "Login" / "authwall", or the page body shows "Sign in to view ... full profile" / "Join to view profile" — LinkedIn served a public/logged-out view.
4. After clicking a search filter or paginating, the URL redirects to `/uas/login` or `/authwall`.

When falling back, **close the headless browser** (`linkedin-headless::close_browser`) and restart the workflow from Step 2 using the visible toolset. Don't try to mix tools mid-run.

### Tool mapping

| Generic action | Headless tool | Visible (Claude in Chrome) tool |
|---|---|---|
| Verify login | `linkedin-headless::check_login_status` | `mcp__Claude_in_Chrome__navigate` to `/feed/` and inspect URL |
| Navigate to URL | `linkedin-headless::navigate` | `mcp__Claude_in_Chrome__navigate` |
| Get page state | `linkedin-headless::get_page_content` | `mcp__Claude_in_Chrome__get_page_text` / `read_page` |
| Run JS | `linkedin-headless::execute_javascript` | `mcp__Claude_in_Chrome__javascript_tool` |
| Wait | `linkedin-headless::wait` | sleep via Bash or browser-side `setTimeout` |
| Screenshot (debug) | `linkedin-headless::screenshot` | `mcp__Claude_in_Chrome__upload_image` (after taking via the extension) |
| Clean up | `linkedin-headless::close_browser` | leave the user's tabs as-is, do nothing |

## Inputs

1. **LinkedIn URL** — target's profile URL (e.g. `https://www.linkedin.com/in/joshsokol`)
2. **Target name** — the person's name (e.g. "Josh Sokol")
3. **Company name** — the company they work at (e.g. "Acme Corp")
4. **Company website** — URL of their company (e.g. `https://acmecorp.com`)

If company name/website are not provided:
- When called from the HubSpot task runner, look up the associated company record in HubSpot for name and domain.
- When called directly, extract the company from the target's LinkedIn profile after navigating to it.

If any required input (LinkedIn URL or target name) is missing, ask the user before proceeding.

## Step 1: Verify Login (and choose backend)

Call `check_login_status` on the headless MCP. If it returns `logged_in: true`, continue down the **HEADLESS path** for the rest of this skill. If it returns false or the tool isn't available, close the headless browser and switch to the **VISIBLE path**.

In either path, capture the **logged-in user's name** for the final Slack header. Headless: it comes from `check_login_status`. Visible: read it from the global nav profile chip after loading `/feed/`.

If neither path can authenticate, stop and tell the user: "Neither headless Chrome nor the Claude in Chrome extension can reach LinkedIn while logged in. Make sure Chrome has an active LinkedIn session, then try again."

## Step 2: Navigate to the Profile

Navigate to the target's LinkedIn profile URL. Confirm the page loaded as the authenticated profile (title is `{Name} | LinkedIn` — NOT "Sign Up" or "authwall"). If the headless path returned an authwall, fall back to visible (close headless first) and re-do Step 2.

## Step 3: Use Two Filtered Searches Instead of the F+S Combined View

LinkedIn's combined "1st + 2nd degree mutual connections" search sorts 2nd-degree first and surfaces 0 first-degree results in the first 10 pages. To make sure 1st-degree connections (the highest-value ones) are captured, use **two separate filtered URLs**:

1. Find the target's LinkedIn member URN by inspecting the profile page. Look for a link with `connectionOf=%5B%22ACoAA...%22%5D` in its href — extract the URN string (the `ACoAA...` part).
2. Build two search URLs:
   - **F-only** (1st degree to me): `https://www.linkedin.com/search/results/people/?origin=MEMBER_PROFILE_CANNED_SEARCH&connectionOf=%5B%22{URN}%22%5D&network=%5B%22F%22%5D`
   - **S-only** (2nd degree to me): same URL but `network=%5B%22S%22%5D`

Visit F-only first.

## Step 4: Extract Connections — Page-by-Page

On each search results page, run JS to extract LinkedIn profile cards. Persist results to `sessionStorage` so they survive navigation between F-only and S-only filter URLs. Wrap the extraction in an IIFE to avoid `window` re-declaration errors when you call it on multiple pages.

```javascript
(() => {
  const slug = "{TARGET_VANITY_SLUG}"; // e.g. "madalyn-trestrail-18ab0ab2"
  let conns = JSON.parse(sessionStorage.getItem('_mutualConns') || '[]');
  const seen = new Set(conns.map(c => c.url));
  let added = 0;
  document.querySelectorAll('a[href*="/in/"]').forEach(a => {
    const url = a.href.split('?')[0];
    if (url.includes(slug) || seen.has(url)) return;
    const text = a.textContent.trim();
    const dMatch = text.match(/[\s•](1st|2nd)(?:\s|[A-Z])/);
    if (!dMatch) return;
    const degree = dMatch[1];
    const namePart = text.split(/\s*•\s*/)[0].trim();
    if (!namePart || namePart.length > 80) return;
    const afterIdx = text.indexOf(dMatch[0]) + dMatch[0].length - 1;
    let titleLoc = text.substring(afterIdx).trim();
    titleLoc = titleLoc.replace(/[^.]+(?:and \d+ other )?mutual connections?\s*$/, '').trim();
    titleLoc = titleLoc.replace(/Status is (online|offline|reachable).*/i, '').trim();
    seen.add(url);
    conns.push({ name: namePart, url, degree, title: titleLoc.substring(0, 150) });
    added++;
  });
  sessionStorage.setItem('_mutualConns', JSON.stringify(conns));
  const btn = Array.from(document.querySelectorAll('button')).find(b =>
    b.textContent.trim() === 'Next' || b.getAttribute('aria-label') === 'Next');
  const cur = document.querySelector('button[aria-current="true"]');
  return JSON.stringify({
    addedThisPage: added,
    total: conns.length,
    first: conns.filter(c => c.degree === '1st').length,
    second: conns.filter(c => c.degree === '2nd').length,
    hasNext: !!btn,
    page: cur ? parseInt(cur.textContent.trim()) : 1
  });
})()
```

Click Next via `nextBtn.click()` (also wrapped in IIFE), wait ~2.5s, repeat.

## Step 5: Pagination Budget

**Total 10-page cap across both filters.** A reasonable split:

- F-only: paginate until the page returns 0 new connections OR you hit page 4 (covers ~30 1st-degree mutuals comfortably).
- S-only: use the remaining pages of the 10-page budget.

If `addedThisPage === 0`, the filter is exhausted — move on (or stop).

## Step 6: Read Final Results

```javascript
JSON.parse(sessionStorage.getItem('_mutualConns') || '[]')
```

Sort: 1st degree first, then 2nd; alphabetical within each.

## Step 7: Post to Slack

Post results to the **#linkedin-leads** channel (ID: `C08CB4WA51P`).

### 7a: Find or create the daily parent message

```
slack_search_public_and_private(
  query: "\"High Priority Leads for {formatted_date}\" in:#linkedin-leads on:{YYYY-MM-DD}"
)
```

Where `{formatted_date}` is e.g. "April 29, 2026" and `{YYYY-MM-DD}` is "2026-04-29".

If found, use its `ts` as `thread_ts`. Otherwise, create it:

```
slack_send_message(
  channel_id: "C08CB4WA51P",
  message: "*High Priority Leads for {formatted_date}*"
)
```

### 7b: Post company reply as thread

```
*{Company Name}*
{company_website_url}

*Key Contact:* <{contact_linkedin_url}|{Contact Name}> — {Title}

*Mutual Connections ({count} found):*

_1st Degree_
• <{url}|{Name}> — {Title}
...

_2nd Degree_
• <{url}|{Name}> — {Title}
...
```

Slack uses single-asterisk for bold. Use `<url|text>` for links. Each Slack message is capped at 5000 chars; split into multiple threaded replies if the connection list overflows. List all 1st-degree connections; for 2nd-degree, list up to ~50 in the first reply with continuation in a follow-up reply.

### 7c: Confirm in chat

```
Posted to #linkedin-leads — {count} mutual connections for {Target Name} at {Company}.
({first_count} 1st degree, {second_count} 2nd degree, via {headless|visible} backend)
```

Do NOT repeat the connection list in chat. The Slack message is the primary output.

## Step 8: Clean Up

If on the headless path, call `linkedin-headless::close_browser` to free resources. If on the visible path, leave the user's Chrome tabs alone — don't close them.

## Error Handling

| Symptom | Action |
|---|---|
| Headless `check_login_status` says not logged in | Close headless browser, retry on visible path |
| Headless tools error "tool not found" | Visible path |
| Profile loads but title says "Sign Up" / "authwall" | Close headless browser, retry on visible path |
| Both paths fail to authenticate | Stop, ask user to ensure Chrome has active LinkedIn session |
| No mutual connections link on profile | Target may have restricted visibility — report and stop |
| Empty result set after both filters | Report "No mutual connections found" |
| CAPTCHA / rate limit | Stop immediately, close browser, alert user — wait 24h before retrying |

## Calling from the HubSpot task runner

When the `do-hubspot-task` skill encounters a CLAUDE-tagged task whose body asks to check mutual connections (phrases like "check mutuals", "mutual connections", "who do we know"), it should invoke this skill with:
- LinkedIn URL: from the associated contact's `hs_linkedin_url` property
- Target name: `firstname + lastname`
- Company name: from the associated company's `name` property
- Company website: from the associated company's `domain` property

This skill posts to Slack regardless of how it was invoked.
