# Autocomplete API Documentation

This document outlines the client-facing workflow for the **Autocomplete** system. It describes how to initiate an autocomplete session, handle asynchronous content generation (Resumes/Cover Letters), and retrieve final results.

---

## 🚀 Workflow Overview

The autocomplete process handles two main scenarios:

1.  **Immediate Autofill**: No complex content generation required. Data is returned immediately.
2.  **Asynchronous Generation**: Requires generating specific Resume or Cover Letter assets. This uses a background job and notifies the client via **Server-Sent Events (SSE)**.

---

## 🔐 Authentication

All endpoints require a valid JWT Access Token.

| Header | Value |
| :--- | :--- |
| **Authorization** | `Bearer <your_access_token>` |

---

## 1️⃣ Step 1: Initiate Autocomplete

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

### Response Highlights
The response determines if you need to wait for further processing.

```json
{
  "success": true,
  "data": {
    "completion_session_ref": "CMP_12345",
    "is_multi_step": true,
    "job_id": "Que_abc123", // Present ONLY if Resume/CV generation is required.
    "autofill_data": [ ... ] // Data available for immediate use
  }
}
```

> [!TIP]
> **Immediate Action**: Always use `autofill_data` to populate form fields right away, even if a `job_id` is present.

---

## 2️⃣ Step 2: Subscribe to Updates (Async Flow)

If a `job_id` is returned, the system is generating Resume Or CV in the background. Subscribe to the SSE channel to be notified when they are ready.

### Endpoint
`GET /events/subscribe/:jobId`

### Mechanism
*   Opens a **Server-Sent Events (SSE)** stream.
*   The client listens for a `completed` or `failed` status.
*   The server automatically closes the connection after the event is emitted.

#### Success Event
```json
{ "data": { "status": "completed" } }
```

---

## 3️⃣ Step 3: Fetch Final Results

Once the `completed` event is received, fetch the final data. This will include the matching scores and generated file URLs.

### Endpoint
`GET /completions/result/:jobId`

### Response Scenarios

#### Scenario A: Requirements Met (Success)
When the applicant meets the core requirements, generated URLs are provided.

```json
{
    "success": true,
    "data": {
        "overall_match": 74.81,
        "requirement_not_met": null,
        "can_apply": true,
        "generated_content": {
            "resume": {
                "field_id": "resume_upload_field",
                "field_value": "https://prewrite-dev.s3.eu-north-1.amazonaws.com/uploads/1763974894484-resume_1763974894484.pdf?..."
            },
            "cover_letter": {
                "field_id": "cover_letter",
                "field_value": "https://prewrite-dev.s3.eu-north-1.amazonaws.com/uploads/1763974901587-cv_1763974901587.pdf?..."
            },
            "job_description_required": false
        },
        "completions_reference": "CMP_12345"
    }
}
```

#### Scenario B: Requirements Not Met
When core requirements (e.g., language proficiency) are missing from the user's profile.

```json
{
    "success": true,
    "data": {
        "overall_match": 69.03,
        "requirement_not_met": [
            "Strong requirement could not be found for 'Proficient in French' in otherInfos (Score: 0.00)"
        ],
        "can_apply": false,
        "generated_content": {
            "resume": null,
            "cover_letter": null,
            "job_description_required": false
        },
        "completions_reference": "CMP_JO5K07MWTXXU"
    }
}
```

### Data Field Definitions

| Field | Type | Description |
| :--- | :--- | :--- |
| `overall_match` | `float` | Percentage score indicating how well the user matches the job. |
| `requirement_not_met` | `string[] \| null` | List of missing requirements that caused a match failure. |
| `can_apply` | `boolean` | Indicates if the user is recommended to proceed with applying. |
| `generated_content` | `object` | Contains `resume` and `cover_letter` objects (or `null`). |
| `field_id` | `string` | The ID of the form field where the file should be uploaded. |
| `field_value` | `string` | The S3 signed URL for the generated document. |

> [!NOTE]
> `resume` and `cover_letter` are **nullable**. Always check for their existence before attempting to download.

---

## 🛠 Backend Reference
*   **Controller**: `src/autocomplete/autocomplete.controller.ts`
*   **Queue Consumer**: `src/infastructure/queues/consumers/delayed.job.consumer.ts`
*   **SSE Events**: `src/event/event.controller.ts`
