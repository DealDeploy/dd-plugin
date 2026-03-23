---
name: do-hubspot-task
description: >
  Fetch and complete HubSpot tasks via the HubSpot MCP. Use when the user wants to work through
  their HubSpot tasks, complete tasks, or check what tasks are pending. Triggers on:
  "HubSpot tasks", "do my tasks", "complete tasks", "mark task complete", "what tasks do I have".
disable-model-invocation: true
---

# Do HubSpot Tasks

Fetch, process, and complete HubSpot tasks via the HubSpot MCP. The user may provide specific instructions on which tasks to complete or how to filter them. If no instructions are given, complete **all** incomplete tasks assigned to the current user that are due today or earlier.

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

## 3. Present Tasks

List the fetched tasks to the user with subject, type, due date, and body summary. If the user gave specific instructions on which tasks to process, filter to those. Otherwise, proceed with all.

## 4. Resolve Associated Records

For each task, use `search_crm_objects` with an association filter to find the associated contact and/or company. Retrieve relevant properties like `firstname`, `lastname`, `email`, `company`, `jobtitle`, `hs_linkedin_url`.

## 5. Execute Task Actions

Process each task based on its subject and body content. The task body (`hs_task_body`) contains instructions — strip HTML tags and trim whitespace. Follow the user's instructions on how to handle each task type. If no specific instructions were given, present the task details and ask the user what action to take.

## 6. Mark Task Complete

After successfully processing a task:

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

- Never execute tasks assigned to another user
- Verify `hubspot_owner_id` matches the current user before processing each task
- Completed tasks won't be re-processed (idempotent)
