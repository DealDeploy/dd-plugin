---
name: hubspot-tasks
description: >
  Fetch and manage HubSpot tasks via the HubSpot MCP. Use when the user mentions HubSpot tasks,
  outreach tasks, "connect on LinkedIn" tasks, or needs to mark tasks complete. Triggers on:
  "HubSpot tasks", "outreach tasks", "fetch tasks", "mark task complete".
disable-model-invocation: true
---

# HubSpot Tasks

Fetch, resolve, and complete HubSpot tasks via the HubSpot MCP.

## Identify Current User

Call `get_user_details` to get the authenticated user's `ownerId`. If this fails, stop.

## Fetch Outreach Tasks

Use `search_crm_objects` with two filter groups (OR logic between groups, AND within):

```
search_crm_objects(
  objectType="tasks",
  filterGroups=[
    {
      "filters": [
        { "propertyName": "hubspot_owner_id", "operator": "EQ", "value": "{owner_id}" },
        { "propertyName": "hs_task_subject", "operator": "CONTAINS_TOKEN", "value": "connect on LinkedIn" },
        { "propertyName": "hs_task_status", "operator": "NEQ", "value": "COMPLETED" },
        { "propertyName": "hs_timestamp", "operator": "LTE", "value": "{end_of_today_unix_ms}" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hubspot_owner_id", "operator": "EQ", "value": "{owner_id}" },
        { "propertyName": "hs_task_subject", "operator": "CONTAINS_TOKEN", "value": "Reach out on Linkedin" },
        { "propertyName": "hs_task_status", "operator": "NEQ", "value": "COMPLETED" },
        { "propertyName": "hs_timestamp", "operator": "LTE", "value": "{end_of_today_unix_ms}" }
      ]
    }
  ],
  properties=["hs_task_subject", "hs_task_body", "hs_task_status", "hs_timestamp", "hubspot_owner_id"]
)
```

If no tasks found: "No LinkedIn outreach tasks due today or earlier. Nothing to process."

## Resolve Contacts

For each task, use `search_crm_objects` with an association filter to find the contact. Retrieve `hs_linkedin_url`, `firstname`, `lastname`, `company`, `jobtitle`.

Skip tasks with no associated contact or no LinkedIn URL.

## Extract Message

The message is `hs_task_body`. Strip HTML tags, trim whitespace. Skip if empty.

## Mark Task Complete

```
manage_crm_objects(
  confirmationStatus="CONFIRMATION_WAIVED_FOR_SESSION",
  updateRequest={
    "objects": [{
      "objectType": "tasks",
      "objectId": {task_id},
      "properties": {
        "hs_task_status": "COMPLETED",
        "hs_task_subject": "✅ LinkedIn Message Sent — {Original Subject}"
      }
    }]
  }
)
```

HubSpot update errors are non-blocking — log but don't stop.

## Guardrails

- Never execute tasks assigned to another user
- Verify `hubspot_owner_id` matches the current user before processing each task
- Completed tasks won't be re-processed (idempotent)
