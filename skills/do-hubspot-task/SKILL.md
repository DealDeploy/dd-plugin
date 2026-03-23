---
name: do-hubspot-task
description: >
  Fetch and complete a single HubSpot task via the HubSpot MCP. Use when the user wants to
  complete a HubSpot task, check what tasks are pending, or mark a task done. Triggers on:
  "HubSpot task", "do my task", "complete task", "mark task complete", "next task".
disable-model-invocation: true
---

# Do HubSpot Task

Fetch, process, and complete **exactly one** HubSpot task per invocation. NEVER process more than one task. If the user wants to complete multiple tasks, they must invoke this skill multiple times.

The user may specify which task to complete. If no specific task is given, pick the oldest due task.

## 1. Identify Current User

Call `get_user_details` to get the authenticated user's `ownerId`. If this fails, stop.

## 2. Fetch Tasks

Build a `search_crm_objects` query for incomplete tasks owned by the current user:

```
search_crm_objects(
  objectType="tasks",
  filterGroups=[
    {
      "filters": [
        { "propertyName": "hubspot_owner_id", "operator": "EQ", "value": "{owner_id}" },
        { "propertyName": "hs_task_status", "operator": "NEQ", "value": "COMPLETED" },
        { "propertyName": "hs_timestamp", "operator": "LTE", "value": "{end_of_today_unix_ms}" }
      ]
    }
  ],
  properties=["hs_task_subject", "hs_task_body", "hs_task_status", "hs_task_type", "hs_timestamp", "hubspot_owner_id"]
)
```

If the user specified filters (e.g. by subject keyword, task type, date range), add those as additional filters. If no tasks found, report that and stop.

## 3. Select One Task

Pick **exactly one** task to process:
- If the user specified which task, select that one.
- Otherwise, select the task with the oldest `hs_timestamp` (earliest due).

Present the selected task to the user with its subject, type, due date, and body summary. Do NOT process any other tasks.

## 4. Resolve Associated Records

For the selected task, use `search_crm_objects` with an association filter to find the associated contact and/or company. Retrieve relevant properties like `firstname`, `lastname`, `email`, `company`, `jobtitle`, `hs_linkedin_url`.

## 5. Execute Task Action

Process the single task based on its subject and body content. The task body (`hs_task_body`) contains instructions — strip HTML tags and trim whitespace. Follow the user's instructions on how to handle the task. If no specific instructions were given, present the task details and ask the user what action to take.

## 6. Mark Task Complete

After successfully processing the task:

```
manage_crm_objects(
  confirmationStatus="CONFIRMATION_WAIVED_FOR_SESSION",
  updateRequest={
    "objects": [{
      "objectType": "tasks",
      "objectId": {task_id},
      "properties": {
        "hs_task_status": "COMPLETED"
      }
    }]
  }
)
```

HubSpot update errors are non-blocking — log but don't stop.

## Guardrails

- **ONE task per invocation** — never process more than one task, even if many are available
- Never execute tasks assigned to another user
- Verify `hubspot_owner_id` matches the current user before processing the task
- Completed tasks won't be re-processed (idempotent)
