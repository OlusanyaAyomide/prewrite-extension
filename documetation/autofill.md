# Autocomplete API Documentation

This document outlines the client-facing workflow for the Autocomplete system. It describes how to initiate an autocomplete session, handle asynchronous content generation (Resumes/Cover Letters), and retrieve the final results.

## Workflow Overview

The autocomplete process handles two scenarios:
1.  **Simple Autofill**: No new content generation required. Returns data immediately.
2.  **Complex Autofill**: Requires generating a specific Resume or Cover Letter. This is an asynchronous process using Server-Sent Events (SSE).

---

## Authentication

All endpoints require a valid JWT Access Token.

**Header:**
`Authorization: Bearer <your_access_token>`

## 1. Initiate Autocomplete

Send the context of the current job application page (scraped fields, job description) to the backend.

### Endpoint
`POST /completions`

### Request Body (`CompletionPayloadDto`)
```json
{
  "completions_session_ref": "OPTIONAL_SESSION_ID",
  "page_url": "https://careers.example.com/job/123",
  "page_title": "Senior Backend Engineer Application",
  "proposed_company_names": ["Tech-Brokas"],
  "proposed_job_titles": ["Backend Developer"],
  "proposed_job_descriptions": ["We are looking for a..."],
  "form_fields": [
    { "field_id": "first_name", "field_type": "text", "field_label": "First Name" },
    { "field_id": "resume", "field_type": "file", "field_label": "Upload Resume" }
  ]
}
```

### Response
The response determines the next step.

```json
{
  "success": true,
  "data": {
    "completion_session_ref": "CMP_12345",
    "is_multi_step": true,
    "job_id": "Que_abc123", // Present ONLY if Resume/CV generation is required.
    "autofill_data": [ ... ] // Immediate data returned
  }
}
```

### Handling the Response
1.  **Immediate Autofill**: Always use `autofill_data` to populate form fields immediately, regardless of `job_id`.
2.  **Async Generation**: Check `job_id`.
    *   If `null`: Process is complete.
    *   If **present**: A Resume or Cover Letter is being generated in the background. Proceed to **Step 2** to wait for the file URLs.

---

## 2. Subscribe to Updates (Async Flow)

If a `job_id` was returned, the server is generating a resume or cover letter in the background. The client must subscribe to an SSE channel to wait for completion.

### Endpoint
`GET /events/subscribe/:jobId`

### Mechanism
*   This endpoint opens a Server-Sent Events (SSE) stream.
*   The client should listen for messages on this stream.

### Events
The stream will emit a JSON object indicating the status:

**Success:**
```json
{
  "data": {
    "status": "completed"
  }
}
```

**Failure:**
```json
{
  "data": {
    "status": "failed",
    "error": "Error message details"
  }
}
```

> **Note**: The SSE connection is closed automatically by the server after the event is emitted.

---

## 3. Fetch Final Results

Once the `completed` event is received, fetch the final data, which will now include the generated Resume/CV URLs.

### Endpoint
`GET /completions/result/:jobId`

### Response
```json
{
  "success": true,
  "data": {
    "overall_match": 85,
    "can_apply": true,
    "generated_content": {
      "resume": {
        "field_id": "resume_upload",
        "field_value": "https://storage.googleapis.com/.../resume.pdf"
      },
      "cover_letter": null,
      "job_description_required": false
    },
    "completions_reference": "CMP_12345"
  }
}
```

---

## Backend Implementation Reference
*   **Initiation**: `AutocompleteController.AutoCompleteForm` (`src/autocomplete/autocomplete.controller.ts`)
*   **Async Processing**: `DelayedJobConsumer` (`src/infastructure/queues/consumers/delayed.job.consumer.ts`) triggers the `ContentGeneratorConsumer`.
*   **SSE Channel**: `EventController.subscribe` (`src/event/event.controller.ts`) listens to `EventsService`.
*   **Confirmation**: When `DelayedJobConsumer` finishes a job, it calls `eventService.emit(job.id, { status: 'completed' })`, which resolves the client's SSE connection.
