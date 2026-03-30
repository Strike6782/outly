# Authentication API

Manage user authentication via Google OAuth 2.0 with JWT token rotation.

---

## Google login

In your `POST /auth/google` request, send the Google OAuth `idToken` received from the GSI SDK.

|Field|Description|
|---|---|
|idToken|Google OAuth credential JWT from the Sign-In SDK|

### Sample request

```bash
curl --request POST \
--url 'http://localhost:8000/auth/google' \
--header 'Content-Type: application/json' \
--header 'Accept: application/json' \
--data '{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}'
```

### Response

The response includes an access token in the body and sets a `refreshToken` httpOnly cookie.

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx1abc2d0000abcdef123456",
    "email": "aniket@gmail.com",
    "name": "Aniket Gautam",
    "avatarUrl": "https://lh3.googleusercontent.com/a/photo"
  }
}
```

### Error Responses

|Status|Response|
|---|---|
|400|`{ "message": "idToken is required" }`|
|400|`{ "message": "Incomplete Google profile" }`|
|401|`{ "message": "Invalid Google token" }`|

---

## Refresh access token

In your `POST /auth/refresh` request, the refresh token is read from the httpOnly cookie. A new access token and rotated refresh token are issued.

### Sample request

```bash
curl --request POST \
--url 'http://localhost:8000/auth/refresh' \
--header 'X-Requested-With: XMLHttpRequest' \
--cookie 'refreshToken=eyJhbGciOiJIUzI1NiJ9...'
```

### Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Error Responses

|Status|Response|
|---|---|
|401|`{ "message": "Missing refresh token" }`|
|401|`{ "message": "Invalid refresh token" }`|
|401|`{ "message": "Token revoked" }`|
|401|`{ "message": "Refresh token expired" }`|

---

## Logout

In your `POST /auth/logout` request, the refresh token is revoked and the cookie is cleared.

### Sample request

```bash
curl --request POST \
--url 'http://localhost:8000/auth/logout' \
--header 'X-Requested-With: XMLHttpRequest' \
--cookie 'refreshToken=eyJhbGciOiJIUzI1NiJ9...'
```

### Response

Returns `204 No Content` on success.

---

# Sender API

Manage Gmail sender accounts with SMTP verification, warmup scheduling, and throttle monitoring.

All endpoints require `Authorization: Bearer <accessToken>` header.

---

## Create a sender

In your `POST /senders` request, provide Gmail credentials. The backend verifies SMTP connectivity before saving.

|Field|Description|
|---|---|
|name|Sender display name (used in the From header)|
|email|Gmail address|
|appPassword|Google App Password (16-character code)|
|skipWarmup|Skip the warmup period (optional, default: false)|

### Sample request

```bash
curl --request POST \
--url 'http://localhost:8000/senders' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest' \
--data '{
  "name": "Aniket Gautam",
  "email": "aniket@gmail.com",
  "appPassword": "abcd efgh ijkl mnop",
  "skipWarmup": false
}'
```

### Response

```json
{
  "id": "clx1abc2d0001abcdef123456",
  "userId": "clx1abc2d0000abcdef123456",
  "email": "aniket@gmail.com",
  "name": "Aniket Gautam",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 465,
  "isVerified": true,
  "dailyLimit": 500,
  "createdAt": "2026-03-12T10:30:00.000Z",
  "updatedAt": "2026-03-12T10:30:00.000Z",
  "providerProfileId": "clx1provider001"
}
```

### Error Responses

|Status|Response|
|---|---|
|400|`{ "message": "Missing required fields: name, appPassword" }`|
|400|`{ "message": "Invalid email format" }`|
|400|`{ "message": "Invalid SMTP credentials. Please check your email and app password." }`|
|409|`{ "message": "A sender with this email already exists for your account" }`|

---

## Verify an existing sender

In your `PATCH /senders/{senderId}/verify` request, add SMTP credentials to an unverified sender created during OAuth signup.

|Field|Description|
|---|---|
|appPassword|Google App Password (required)|
|name|Updated display name (optional)|
|skipWarmup|Skip warmup period (optional)|

### Sample request

```bash
curl --request PATCH \
--url 'http://localhost:8000/senders/clx1abc2d0001abcdef123456/verify' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest' \
--data '{
  "appPassword": "abcd efgh ijkl mnop",
  "name": "Aniket Outreach"
}'
```

### Response

Same shape as Create a sender response with `isVerified: true`.

### Error Responses

|Status|Response|
|---|---|
|400|`{ "message": "App password is required" }`|
|400|`{ "message": "Invalid SMTP credentials. Please check your app password." }`|
|404|`{ "message": "Sender not found" }`|

---

## Get all senders

In your `GET /senders` request, retrieve all senders for the authenticated user with live daily send counts.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/senders' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
[
  {
    "id": "clx1abc2d0001abcdef123456",
    "userId": "clx1abc2d0000abcdef123456",
    "email": "aniket@gmail.com",
    "name": "Aniket Gautam",
    "smtpHost": "smtp.gmail.com",
    "smtpPort": 465,
    "isVerified": true,
    "dailyLimit": 500,
    "createdAt": "2026-03-12T10:30:00.000Z",
    "updatedAt": "2026-03-12T10:30:00.000Z",
    "currentDailyCount": 42
  }
]
```

---

## Get sender detail

In your `GET /senders/{senderId}` request, get detailed sender information including throttle state, warmup status, and cooldown.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/senders/clx1abc2d0001abcdef123456' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
{
  "id": "clx1abc2d0001abcdef123456",
  "email": "aniket@gmail.com",
  "name": "Aniket Gautam",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 465,
  "isVerified": true,
  "dailyLimit": 500,
  "hourlyLimit": null,
  "currentHourlyCount": 8,
  "currentDailyCount": 42,
  "effectiveDailyLimit": 100,
  "warmupStatus": "active",
  "cooldownState": {
    "status": "inactive",
    "expiresAt": null
  }
}
```

### Response Fields

|Field|Description|
|---|---|
|currentHourlyCount|Emails sent in the current hour|
|currentDailyCount|Emails sent today (UTC)|
|effectiveDailyLimit|Actual daily limit after warmup and throttle adjustments|
|warmupStatus|`active` (in warmup), `inactive` (warmup complete), or `opted-out`|
|cooldownState.status|`active` (sender in cooldown) or `inactive`|
|cooldownState.expiresAt|ISO timestamp when cooldown expires, or null|

---

# Campaign API

Create and manage email campaigns with multi-sender rotation, scheduling, and real-time controls.

All endpoints require `Authorization: Bearer <accessToken>` header.

---

## Create a campaign

In your `POST /campaigns` request, provide the full campaign configuration.

|Field|Description|
|---|---|
|senderIds|Array of sender IDs for multi-sender rotation|
|subject|Email subject line (supports `{{variables}}`)|
|body|HTML email body from the editor|
|startTime|ISO 8601 timestamp for when to begin sending|
|delaySeconds|Base delay between emails in seconds|
|hourlyLimit|Maximum emails per hour per sender|
|emails|Array of recipient emails or objects with columnData|
|attachments|Array of uploaded attachment metadata (optional)|
|steps|Array of follow-up sequence steps (optional)|
|trackOpens|Enable open tracking pixel (optional, default: true)|
|trackClicks|Enable click tracking links (optional, default: true)|
|dynamicSenderVars|Inject sender variables at send time (optional, default: false)|

### Sample request

```bash
curl --request POST \
--url 'http://localhost:8000/campaigns' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest' \
--data '{
  "senderIds": ["clx1sender001", "clx1sender002"],
  "subject": "Hi {{Name}}, opportunity at {{Company}}",
  "body": "<p>Hi {{Name}},</p><p>I am interested in the {{Role}} position...</p>",
  "startTime": "2026-03-13T09:00:00.000Z",
  "delaySeconds": 30,
  "hourlyLimit": 50,
  "emails": [
    { "email": "recruiter@company.com", "columnData": { "Name": "Sarah", "Company": "Google", "Role": "SDE" } },
    { "email": "hr@startup.com", "columnData": { "Name": "Mike", "Company": "Startup Inc", "Role": "Backend Dev" } }
  ],
  "trackOpens": true,
  "trackClicks": true,
  "steps": [
    { "subject": "Following up — {{Name}}", "body": "<p>Hi {{Name}}, just checking in...</p>", "waitDays": 3 }
  ]
}'
```

### Response

```json
{
  "message": "Campaign scheduled successfully",
  "campaignId": "clx1campaign001",
  "senderPool": [
    { "senderId": "clx1sender001", "email": "aniket@gmail.com", "name": "Aniket", "dailyLimit": 500, "rotationOrder": 0 },
    { "senderId": "clx1sender002", "email": "outreach@gmail.com", "name": "Outreach", "dailyLimit": 500, "rotationOrder": 1 }
  ]
}
```

### Error Responses

|Status|Response|
|---|---|
|400|`{ "message": "At least one sender is required" }`|
|400|`{ "message": "Missing required fields: subject, emails" }`|
|400|`{ "message": "At least one recipient email is required" }`|
|400|`{ "message": "delaySeconds must be a number >= 0" }`|
|400|`{ "message": "hourlyLimit must be a number > 0" }`|
|400|`{ "message": "All senders must be verified" }`|
|400|`{ "message": "Total attachment size exceeds the 25 MB limit" }`|
|403|`{ "message": "Sender not found or not owned by you" }`|

---

## Get all campaigns

In your `GET /campaigns` request, retrieve all campaigns for the authenticated user.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/campaigns' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
[
  {
    "id": "clx1campaign001",
    "userId": "clx1abc2d0000abcdef123456",
    "senderId": "clx1sender001",
    "subject": "Hi {{Name}}, opportunity at {{Company}}",
    "body": "<p>Hi {{Name}},</p>...",
    "startTime": "2026-03-13T09:00:00.000Z",
    "delaySeconds": 30,
    "hourlyLimit": 50,
    "totalRecipients": 150,
    "status": "SENDING",
    "pauseReason": null,
    "trackOpens": true,
    "trackClicks": true,
    "createdAt": "2026-03-12T10:30:00.000Z",
    "sender": {
      "id": "clx1sender001",
      "email": "aniket@gmail.com",
      "name": "Aniket Gautam",
      "isVerified": true
    }
  }
]
```

---

## Get campaign detail

In your `GET /campaigns/{campaignId}` request, get full campaign data including email jobs, sender pool, sender stats, and status counts.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/campaigns/clx1campaign001' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
{
  "id": "clx1campaign001",
  "subject": "Hi {{Name}}, opportunity at {{Company}}",
  "status": "SENDING",
  "totalRecipients": 150,
  "senderPool": [
    { "senderId": "clx1sender001", "email": "aniket@gmail.com", "name": "Aniket", "dailyLimit": 500, "rotationOrder": 0 }
  ],
  "senderStats": [
    { "senderId": "clx1sender001", "email": "aniket@gmail.com", "sent": 42, "failed": 1, "pending": 107 }
  ],
  "_count": {
    "pending": 107,
    "sending": 1,
    "sent": 42,
    "failed": 1,
    "cancelled": 0
  },
  "effectiveSendRate": 10,
  "activeThrottleReasons": ["warmup"],
  "estimatedCompletionTime": 11,
  "emails": [
    {
      "id": "clx1email001",
      "toEmail": "recruiter@company.com",
      "status": "SENT",
      "sentAt": "2026-03-13T09:01:15.000Z",
      "isStarred": false,
      "isReplied": false,
      "sender": { "id": "clx1sender001", "email": "aniket@gmail.com", "name": "Aniket" }
    }
  ]
}
```

### Response Fields

|Field|Description|
|---|---|
|senderPool|Senders assigned to this campaign with rotation order|
|senderStats|Per-sender breakdown of sent, failed, and pending counts|
|_count|Aggregate status counts across all email jobs|
|effectiveSendRate|Current combined sends per minute across all senders|
|activeThrottleReasons|Active throttle reasons: `warmup`, `error-throttled`, `rate-limited`|
|estimatedCompletionTime|Estimated minutes to complete remaining emails|

---

## Pause a campaign

In your `PATCH /campaigns/{campaignId}/pause` request, pause a SCHEDULED or SENDING campaign.

### Sample request

```bash
curl --request PATCH \
--url 'http://localhost:8000/campaigns/clx1campaign001/pause' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest'
```

### Response

Returns the campaign object with `"status": "PAUSED"`.

### Error Responses

|Status|Response|
|---|---|
|404|`{ "message": "Campaign not found" }`|
|403|`{ "message": "Forbidden" }`|
|409|`{ "message": "Cannot pause campaign in COMPLETED state" }`|

---

## Resume a campaign

In your `PATCH /campaigns/{campaignId}/resume` request, resume a PAUSED campaign. PENDING jobs with past scheduledAt are rescheduled.

### Sample request

```bash
curl --request PATCH \
--url 'http://localhost:8000/campaigns/clx1campaign001/resume' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest'
```

### Response

Returns the campaign object with `"status": "SENDING"`.

If all jobs are already terminal, returns `"status": "COMPLETED"` instead.

---

## Cancel a campaign

In your `PATCH /campaigns/{campaignId}/cancel` request, cancel a campaign. All PENDING email jobs are marked CANCELLED. Jobs already SENDING will complete.

### Sample request

```bash
curl --request PATCH \
--url 'http://localhost:8000/campaigns/clx1campaign001/cancel' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest'
```

### Response

Returns the campaign object with `"status": "CANCELLED"`.

---

## Get campaign throttle status

In your `GET /campaigns/{campaignId}/throttle-status` request, get live per-sender throttle information.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/campaigns/clx1campaign001/throttle-status' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
{
  "campaignId": "clx1campaign001",
  "senders": [
    {
      "senderId": "clx1sender001",
      "email": "aniket@gmail.com",
      "name": "Aniket Gautam",
      "currentHourlyCount": 8,
      "currentDailyCount": 42,
      "effectiveLimits": {
        "perMinute": 10,
        "perHour": 100,
        "perDay": 100
      },
      "warmupStatus": "active",
      "cooldownState": {
        "status": "inactive",
        "expiresAt": null
      }
    }
  ]
}
```

---

## Search campaigns

In your `GET /campaigns/search` request, search campaigns with combinable filters.

### Query Parameters

|Parameter|Description|
|---|---|
|q|Search query (matches subject)|
|status|Filter by status: SCHEDULED, SENDING, PAUSED, CANCELLED, COMPLETED|
|senderId|Filter by sender ID|
|dateFrom|Start date filter (ISO 8601)|
|dateTo|End date filter (ISO 8601)|

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/campaigns/search?q=recruiter&status=SENDING' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
{
  "results": [...],
  "total": 5,
  "filters": { "q": "recruiter", "status": "SENDING" }
}
```

---

# Email API

Query and manage individual email jobs within campaigns.

All endpoints require `Authorization: Bearer <accessToken>` header.

---

## Search emails

In your `GET /emails/search` request, search across all emails with combinable filters. Supports searching within CSV column data.

### Query Parameters

|Parameter|Description|
|---|---|
|q|Search query (matches recipient, subject, body, and CSV column data)|
|status|Filter by status: PENDING, SENDING, SENT, FAILED, CANCELLED|
|senderId|Filter by sender ID|
|dateFrom|Start date filter (ISO 8601)|
|dateTo|End date filter (ISO 8601)|
|dateField|Date field to filter on: `createdAt` (default), `scheduledAt`, `sentAt`|
|starred|Filter starred emails: `true`|

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/emails/search?q=Google&status=SENT&starred=true' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
{
  "results": [
    {
      "id": "clx1email001",
      "campaignId": "clx1campaign001",
      "toEmail": "recruiter@google.com",
      "status": "SENT",
      "sentAt": "2026-03-13T09:01:15.000Z",
      "isStarred": true,
      "isReplied": false,
      "columnData": { "Name": "Sarah", "Company": "Google" },
      "campaign": {
        "subject": "Hi {{Name}}, opportunity at {{Company}}",
        "sender": { "id": "clx1sender001", "email": "aniket@gmail.com", "name": "Aniket" }
      }
    }
  ],
  "total": 1,
  "filters": { "q": "Google", "status": "SENT", "starred": "true" }
}
```

---

## Toggle email star

In your `PATCH /emails/{emailId}/star` request, toggle the starred flag on an email.

### Sample request

```bash
curl --request PATCH \
--url 'http://localhost:8000/emails/clx1email001/star' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest'
```

### Response

Returns the updated email job object with the toggled `isStarred` value.

---

## Toggle email replied

In your `PATCH /emails/{emailId}/replied` request, toggle the replied flag. Only SENT emails can be marked as replied. For sequence campaigns, this also updates the recipient's sequence state to stop further follow-ups.

### Sample request

```bash
curl --request PATCH \
--url 'http://localhost:8000/emails/clx1email001/replied' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest'
```

### Response

Returns the updated email job object with the toggled `isReplied` value.

### Error Responses

|Status|Response|
|---|---|
|404|`{ "message": "Email not found" }`|
|409|`{ "message": "Only sent emails can be marked as replied" }`|

---

## Get scheduled emails

In your `GET /emails/schedule` request, get PENDING emails ordered by scheduled time.

### Query Parameters

|Parameter|Description|
|---|---|
|limit|Max results (default: 50, max: 200)|
|offset|Pagination offset (default: 0)|

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/emails/schedule?limit=20' \
--header 'Authorization: Bearer eyJhbG...'
```

---

## Get sent emails

In your `GET /emails/sent` request, get SENT emails ordered by sent time (newest first).

### Query Parameters

|Parameter|Description|
|---|---|
|limit|Max results (default: 50, max: 200)|
|offset|Pagination offset (default: 0)|

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/emails/sent?limit=20' \
--header 'Authorization: Bearer eyJhbG...'
```

---

# Sequence API

Manage follow-up email sequences with per-recipient controls.

All endpoints are mounted at `/campaigns/{campaignId}/sequence` and require `Authorization: Bearer <accessToken>` header.

---

## Get sequence

In your `GET /campaigns/{campaignId}/sequence` request, get all sequence steps and per-recipient states.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/campaigns/clx1campaign001/sequence' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

Returns sequence steps and recipient states with step-by-step progress.

---

## Pause all sequences

In your `PATCH /campaigns/{campaignId}/sequence/pause` request, pause all active recipient sequences in the campaign.

### Sample request

```bash
curl --request PATCH \
--url 'http://localhost:8000/campaigns/clx1campaign001/sequence/pause' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest'
```

---

## Resume all sequences

In your `PATCH /campaigns/{campaignId}/sequence/resume` request, resume all paused recipient sequences.

---

## Stop all sequences

In your `PATCH /campaigns/{campaignId}/sequence/stop` request, stop all sequences. Recipients are marked as completed and receive no further follow-ups.

---

## Pause a recipient's sequence

In your `PATCH /campaigns/{campaignId}/sequence/recipients/{recipientId}/pause` request, pause a single recipient's sequence.

---

## Resume a recipient's sequence

In your `PATCH /campaigns/{campaignId}/sequence/recipients/{recipientId}/resume` request, resume a paused recipient's sequence.

---

## Stop a recipient's sequence

In your `PATCH /campaigns/{campaignId}/sequence/recipients/{recipientId}/stop` request, permanently stop a recipient's sequence.

---

# Template API

Save and reuse email templates with subject and body content.

All endpoints require `Authorization: Bearer <accessToken>` header.

---

## Create a template

In your `POST /templates` request, save a new email template.

|Field|Description|
|---|---|
|name|Template name (unique per user)|
|subject|Email subject line|
|body|HTML email body|

### Sample request

```bash
curl --request POST \
--url 'http://localhost:8000/templates' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest' \
--data '{
  "name": "Cold Outreach v1",
  "subject": "Hi {{Name}}, interested in {{Role}} at {{Company}}",
  "body": "<p>Hi {{Name}},</p><p>I came across the {{Role}} opening...</p>"
}'
```

### Response

```json
{
  "id": "clx1template001",
  "userId": "clx1abc2d0000abcdef123456",
  "name": "Cold Outreach v1",
  "subject": "Hi {{Name}}, interested in {{Role}} at {{Company}}",
  "body": "<p>Hi {{Name}},</p><p>I came across the {{Role}} opening...</p>",
  "createdAt": "2026-03-12T10:30:00.000Z",
  "updatedAt": "2026-03-12T10:30:00.000Z"
}
```

### Error Responses

|Status|Response|
|---|---|
|400|`{ "message": "Template name is required" }`|
|400|`{ "message": "Missing required fields: subject" }`|
|409|`{ "message": "A template with this name already exists" }`|

---

## Get all templates

In your `GET /templates` request, retrieve all templates for the authenticated user.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/templates' \
--header 'Authorization: Bearer eyJhbG...'
```

---

## Update a template

In your `PUT /templates/{templateId}` request, update an existing template.

|Field|Description|
|---|---|
|name|Updated template name (optional)|
|subject|Updated subject (optional)|
|body|Updated body (optional)|

### Sample request

```bash
curl --request PUT \
--url 'http://localhost:8000/templates/clx1template001' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest' \
--data '{
  "subject": "Updated subject — Hi {{Name}}"
}'
```

---

## Delete a template

In your `DELETE /templates/{templateId}` request, permanently delete a template.

### Sample request

```bash
curl --request DELETE \
--url 'http://localhost:8000/templates/clx1template001' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest'
```

---

# Attachment API

Upload and manage email attachments stored in Cloudinary.

All endpoints require `Authorization: Bearer <accessToken>` header.

---

## Upload attachments

In your `POST /attachments/upload` request, send files as multipart form data. Files are uploaded to Cloudinary and metadata is returned.

### Constraints

- Maximum 10 MB per file
- Maximum 25 MB total per campaign
- Allowed MIME types: PDF, DOC, DOCX, images, text files

### Sample request

```bash
curl --request POST \
--url 'http://localhost:8000/attachments/upload' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest' \
--form 'files=@resume.pdf' \
--form 'files=@cover_letter.docx'
```

### Response

```json
[
  {
    "url": "https://res.cloudinary.com/dsouhrbvy/raw/upload/v1710000000/resume.pdf",
    "filename": "resume.pdf",
    "size": 245760,
    "mimeType": "application/pdf"
  },
  {
    "url": "https://res.cloudinary.com/dsouhrbvy/raw/upload/v1710000001/cover_letter.docx",
    "filename": "cover_letter.docx",
    "size": 102400,
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
]
```

---

## Delete an attachment

In your `DELETE /attachments/delete` request, remove a file from Cloudinary.

|Field|Description|
|---|---|
|url|Cloudinary URL of the file to delete|

### Sample request

```bash
curl --request DELETE \
--url 'http://localhost:8000/attachments/delete' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbG...' \
--header 'X-Requested-With: XMLHttpRequest' \
--data '{
  "url": "https://res.cloudinary.com/dsouhrbvy/raw/upload/v1710000000/resume.pdf"
}'
```

---

# Tracking API

Public endpoints for recording email opens and clicks. No authentication required — these URLs are embedded in sent emails.

---

## Record an open

In your `GET /track/open/{emailJobId}` request (triggered by email clients loading the tracking pixel), an OPEN event is recorded and a 1x1 transparent GIF is returned.

### Sample request

```
GET /track/open/clx1email001
```

### Response

Returns a 1x1 transparent GIF image (`image/gif`).

---

## Record a click

In your `GET /track/click/{emailJobId}` request (triggered by recipients clicking tracked links), a CLICK event is recorded and the user is redirected to the original URL.

### Query Parameters

|Parameter|Description|
|---|---|
|url|URL-encoded original destination URL|

### Sample request

```
GET /track/click/clx1email001?url=https%3A%2F%2Flinkedin.com%2Fin%2Faniket
```

### Response

Returns a `302 Found` redirect to the decoded original URL.

---

# Tracking Metrics API

Retrieve campaign-level tracking analytics.

All endpoints require `Authorization: Bearer <accessToken>` header.

---

## Get campaign metrics

In your `GET /api/tracking/campaigns/{campaignId}` request, get aggregate open and click metrics.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/api/tracking/campaigns/clx1campaign001' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
{
  "totalSent": 150,
  "totalOpens": 87,
  "uniqueOpens": 62,
  "openRate": 0.413,
  "totalClicks": 34,
  "uniqueClicks": 28,
  "clickRate": 0.187
}
```

---

## Get per-email tracking

In your `GET /api/tracking/campaigns/{campaignId}/emails` request, get tracking details for each email in the campaign.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/api/tracking/campaigns/clx1campaign001/emails' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
{
  "emails": [
    {
      "emailJobId": "clx1email001",
      "toEmail": "recruiter@google.com",
      "openCount": 3,
      "clickCount": 1,
      "lastOpenAt": "2026-03-13T14:22:00.000Z",
      "lastClickAt": "2026-03-13T14:23:00.000Z"
    }
  ]
}
```

---

## Get per-link tracking

In your `GET /api/tracking/campaigns/{campaignId}/links` request, get click aggregation per unique URL.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/api/tracking/campaigns/clx1campaign001/links' \
--header 'Authorization: Bearer eyJhbG...'
```

### Response

```json
{
  "links": [
    {
      "url": "https://linkedin.com/in/aniket",
      "totalClicks": 28,
      "uniqueClicks": 22
    },
    {
      "url": "https://github.com/aniket",
      "totalClicks": 6,
      "uniqueClicks": 6
    }
  ]
}
```

---

# Health Check

---

## Check service health

In your `GET /health` request, verify that the API server, database, and Redis are operational.

### Sample request

```bash
curl --request GET \
--url 'http://localhost:8000/health'
```

### Response

When all services are healthy:

```json
{
  "status": "ok",
  "db": "connected",
  "redis": "PONG"
}
```

When a service is degraded:

```json
{
  "status": "degraded",
  "error": "Connection refused"
}
```

---

## Common Headers

All authenticated requests require:

|Header|Value|Description|
|---|---|---|
|Authorization|`Bearer <accessToken>`|JWT access token from login|
|X-Requested-With|`XMLHttpRequest`|Required on all mutating requests (POST, PUT, PATCH, DELETE) for CSRF protection|
|Content-Type|`application/json`|Required for requests with JSON body|

## Campaign Status Values

|Status|Description|
|---|---|
|SCHEDULED|Campaign created, waiting for start time|
|SENDING|Emails are being processed by the worker|
|PAUSED|Campaign paused by user or auto-paused (sender exhaustion)|
|CANCELLED|Campaign cancelled, remaining emails will not be sent|
|COMPLETED|All emails reached terminal state|

## Email Status Values

|Status|Description|
|---|---|
|PENDING|Queued, waiting to be processed|
|SENDING|Worker has claimed the job and is sending|
|SENT|Successfully delivered to SMTP server|
|FAILED|SMTP error or other permanent failure|
|CANCELLED|Cancelled as part of campaign cancellation|
