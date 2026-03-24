---
name: check-mutual-connections
description: Scrape all mutual 1st and 2nd degree LinkedIn connections between the logged-in user and a target profile
---

# Check Mutual Connections

Given a LinkedIn URL and target name, scrape all mutual 1st and 2nd degree connections.

## Inputs

1. **LinkedIn URL** — target's profile URL (e.g. `https://www.linkedin.com/in/joshsokol`)
2. **Target name** — the person's name (e.g. "Josh Sokol")

If any input is missing, ask the user before proceeding.

## Step 1: Read Browser Reference

Read the `linkedin-browser` skill before any browser interaction. This is mandatory — it contains DOM tips, selector patterns, and timing guidance that prevent known failures.

## Step 2: Identify the Logged-In User

Before navigating to the target, identify the currently logged-in LinkedIn user. Look for the profile picture / "Me" nav item in the top nav bar, or navigate to `https://www.linkedin.com/feed/` and extract the logged-in user's name from the nav or profile card. You need:

- **Logged-in user's name** (e.g. "Mathew Pregasen")

Store this — it's used in the final output header to show whose perspective these mutual connections are from.

## Step 3: Navigate to the Profile

Open the target's LinkedIn profile in the browser. The user must already be logged in.

If the page shows a login wall, stop and tell the user.

## Step 4: Open Mutual Connections

After the profile loads, find the mutual connections link — it reads something like "Sammy Abdullah, Mark Tornetta, and 11 other mutual connections". Click it.

This opens a search results page filtered to the target with 1st-degree connections checked by default.

## Step 5: Enable 2nd-Degree Filter FIRST

**Important: Enable 2nd degree before extracting any results.** This lets you collect all connections (1st and 2nd) in a single pass instead of paginating twice.

On the search results page, find the 2nd-degree connection filter (a radio button or checkbox labeled "2nd"). Click it so both 1st and 2nd are checked simultaneously.

Wait 2 seconds for results to reload.

**Why this order matters:** The default search shows only 1st degree connections. If you extract 1st degree first and then add the 2nd degree filter, the results reshuffle completely — 1st degree connections reappear on later pages, causing duplicate work. Enabling both filters upfront avoids this.

**Pagination warning:** LinkedIn dynamically expands page count as you go deeper. A search that initially shows 10 pages may grow to 15, 17, 18+ as you paginate. This is normal — keep going until "Next" disappears.

## Step 6: Extract Connections

For each page of results, extract:

- **Name**
- **LinkedIn profile URL** (the `/in/` link)
- **Connection degree** (1st or 2nd — parse from `• 1st` or `• 2nd` in the link text)
- **Title** (job title / headline)

**Preferred: JavaScript evaluation** in the browser context:

```javascript
JSON.stringify(
  Array.from(document.querySelectorAll('a[href*="/in/"]'))
    .map(a => {
      var text = a.textContent.trim().substring(0, 400);
      var url = a.href.split('?')[0];
      var degree = text.includes('2nd') ? '2nd' : text.includes('1st') ? '1st' : null;
      return { text: text, url: url, degree: degree };
    })
    .filter(a => a.url.includes('/in/') && !a.url.includes('/in/{target_slug}') && a.degree)
    .reduce((acc, a) => { if (!acc.some(x => x.url === a.url)) acc.push(a); return acc; }, [])
)
```

This captures degree info from the link text in a single pass, so you don't need separate extraction logic per degree.

**Fallback: Parse the accessibility tree / snapshot.** Each result entry contains name, degree, title, location. Profile URLs can be extracted by reading link hrefs.

## Step 7: Paginate

Check for "Next" or page number buttons. If they exist, click "Next", wait 2 seconds, repeat step 6.

Continue until "Next" is absent. Note: LinkedIn may show up to 10 page buttons at a time — new ones appear as you advance, so don't assume the highest visible page number is the last.

## Step 8: Deduplicate, Format, and Output

Combine all pages. Deduplicate by LinkedIn URL. Sort: 1st degree first, then 2nd, alphabetical within each group.

### Output Format

```
*Mutual Connections: {Logged-In User Name} ↔ {Target Name}*

*{Target Name}*
{Title} | {Location}
{linkedin_url}

*1st Degree*
- <{url}|{Name}> — {Title}
- <{url}|{Name}> — {Title}

*2nd Degree*
- <{url}|{Name}> — {Title} (via {mutual name} + {N} other mutuals)
- <{url}|{Name}> — {Title} (via {mutual name} + {N} other mutuals)
```

**Rules:**
- First line is a header showing whose mutual connections these are: the logged-in user's name and the target's name, connected with `↔`
- Next block is the target's name in bold, followed by their title, location, and LinkedIn URL
- Group connections under `*1st Degree*` and `*2nd Degree*` headers
- Each connection is: `- <linkedin_url|Name> — Title`
- For 2nd degree connections, append `(via {mutual name} + {N} other mutuals)` if mutual connection info is available from the search results
- Do NOT include a status line (e.g. "Connect button available") — just the connections
- Include LinkedIn URLs for every connection that has one
- Keep messages under ~4000 chars; split into multiple if needed

## Error Handling

- **Login wall** — stop, tell user to log in
- **No mutual connections link** — target may have restricted visibility, inform user
- **Empty results** — report "No mutual connections found"
- **Rate limit / CAPTCHA** — stop immediately, alert user
