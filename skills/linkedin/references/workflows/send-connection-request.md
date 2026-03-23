# Send Connection Request

Send a personalized LinkedIn connection request to a single profile.

## Inputs

1. **LinkedIn URL** — target's profile URL
2. **Name** — the person's name
3. **Message** — the connection note to include (max 300 characters)

If any input is missing, ask the user before proceeding.

## Step 1: Read Browser Reference

Read [../browser-automation-reference.md](../browser-automation-reference.md) before any browser interaction. This is mandatory.

## Step 2: Navigate to Profile

Open the LinkedIn profile URL. The user must already be logged in.

If the page shows a login wall, stop and tell the user.

## Step 3: Detect Profile State

Look for action buttons on the profile:

- **"Connect" visible** — proceed to send
- **"Pending"** — already sent, skip
- **"Message" (no Connect)** — already connected, skip
- **No Connect found** — click "More actions" dropdown, check again. If still not found, log as failed.

## Step 4: Send Connection Request

1. Click "Connect"
2. Wait 1-2 seconds for modal
3. Click "Add a note"
4. Type the message into the textarea (use keystroke-based typing, NOT `fill`)
5. Click "Send"
6. Verify the button now shows "Pending"

LinkedIn caps connection notes at **300 characters**. Truncate to 297 + "..." if needed.

## Step 5: Pause

Wait **4 seconds** before processing the next profile (if part of a batch).

## Error Handling

- **Login wall** — stop, tell user to log in
- **Profile 404** — log as failed, continue
- **No Connect button** — check "More" menu first, then fail
- **Already connected or pending** — skip
- **Modal doesn't appear** — wait 2s, retry once, then fail
- **Rate limit / CAPTCHA** — stop everything, alert user

## Guardrails

- Always add a note — never "Send without a note"
- Process sequentially with pauses — never parallel
