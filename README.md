<p align="center">
  <img src="client/public/favicon.svg" alt="Outly" width="80" height="80" />
</p>

<h1 align="center">Outly</h1>

<p align="center">
  Cold outreach email platform for job seekers.<br/>
  Send personalized emails to recruiters at scale with smart scheduling, multi-sender rotation, and follow-up sequences.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=flat&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Express_5-000000?style=flat&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/BullMQ-E34F26?style=flat&logoColor=white" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat" alt="MIT License" />
</p>

---

## What is Outly

Outly is a cold outreach platform designed for job seekers who want to reach recruiters through cold email. Connect your email accounts (Gmail, Outlook, Zoho, Yahoo, or any custom provider), import recipients from a CSV, write personalized emails with template variables, and let Outly handle the scheduling, sending limits, and follow-ups.

Built for deliverability: adaptive sender warmup, intelligent sending limits, natural sending patterns, inbox protection with bounce and reply detection, and automatic blocking of invalid recipients.

---

## Features

### Campaign Management
- Create campaigns with one or multiple senders (Gmail, Outlook, Zoho, Yahoo, or any custom provider)
- Automatic sender rotation with failover when daily limits are reached
- Pause, resume, and cancel campaigns in real-time
- Schedule campaigns for future delivery
- Live campaign monitoring with auto-refresh
- Smart recipient ordering to maximize deliverability

### Multi-Provider Support
- Gmail and Google Workspace
- Outlook/Office 365, Zoho, Yahoo
- Any email provider with custom connection settings
- Works out of the box — just enter your email and credentials
- Connection security validation
- Checks if your domain is properly set up for email delivery

### Human-Like Sending Engine
- Intelligent sending limits that adapt to provider restrictions
- Natural send timing with realistic delays and pauses between emails
- Business hours window with configurable start/end time and timezone
- Sending speed varies throughout the day to mimic real human behavior
- Random pauses of varying lengths between sends
- Each day's sending pattern is unique and non-repeating
- Every email has a unique structure to avoid spam filter detection
- Clean email headers with no automation markers

### 28-Day Adaptive Warmup
- Gradual daily volume increase over 28 days per sender
- Automatically adjusts based on bounce rates, reply rates, and errors
- Randomized starting volume per sender for natural ramp-up
- Daily volume varies slightly to avoid predictable patterns
- Auto-pauses warmup if deliverability signals are poor
- Cautious recovery after issues are resolved
- Fully configurable via settings

### Bounce and Reply Detection
- Automatic inbox monitoring for bounces and replies (Gmail, Outlook, Yahoo, Zoho, custom)
- Bounced emails are detected and marked automatically
- Replies are detected and follow-up sequences stop automatically
- Bounced recipients are automatically blocked from future campaigns
- Invalid recipients are filtered out at both campaign creation and send time
- Safe concurrent processing per sender
- Automatic retry on temporary failures
- Configurable monitoring interval

### Reply Threading
- Follow-up emails appear in the same thread as the original email
- Proper thread grouping across all email providers
- Full conversation chain maintained across all follow-up steps

### Follow-Up Sequences
- Up to 5 automated follow-up steps per campaign
- Configurable wait periods between steps (in days)
- Per-recipient sequence controls: pause, resume, stop
- Sequences stop automatically on reply detection
- Sequences halt on bounce detection
- Bulk controls for all recipients in a campaign

### Email Composition
- Rich text editor with formatting, links, colors, and alignment
- Template variables from CSV data: `{{Name}}`, `{{Company}}`, `{{Role}}`
- Dynamic sender variables: `{{senderEmail}}`, `{{senderName}}`
- Reusable email templates (save, edit, delete, apply)
- File attachments (10 MB per file, 25 MB total)
- Variable preview before sending

### Email Tracking
- Open tracking to see who read your emails
- Click tracking to see who clicked your links
- Campaign-level metrics: open rate, click rate, unique opens, unique clicks
- Per-email tracking details with bounce reason display
- Per-link click breakdown
- Bounced and replied status indicators on campaign detail page

### Abuse Protection
- Multi-tier protection to prevent misuse
- Automatic retry when limits are hit

### Security
- Google sign-in
- Encrypted storage for all email credentials
- Short-lived sessions with automatic refresh
- Cross-site request protection
- Connection security validation
- User-scoped data isolation on all queries
- Secure HTTP headers

### Worker Resilience
- Automatic recovery of interrupted jobs on startup
- Periodic detection and re-processing of stuck jobs
- Stuck campaign detection and auto-completion
- Graceful shutdown with in-flight job completion
- Auto-resume for campaigns paused due to sender limits
- Scheduled follow-up processing
- Periodic bounce and reply detection
- Automatic retries on failures

---

## Architecture

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Frontend  │──────▶│   Backend   │──────▶│  Database   │
│  (Next.js)  │◀──────│  (Express)  │──────▶│  (Postgres) │
└─────────────┘       └──────┬──────┘       └─────────────┘
                             │
                      ┌──────▼──────┐
                      │  Background │
                      │   Workers   │
                      └──────┬──────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  Email   │  │ Warmup & │  │ Follow-up│
        │ Delivery │  │ Inbox    │  │ Scheduler│
        │          │  │ Monitor  │  │          │
        └──────────┘  └──────────┘  └──────────┘
```

The frontend and backend run as separate services. The backend handles API requests and delegates email processing to background workers. Workers manage sending, inbox monitoring, warmup adjustments, and follow-up scheduling independently.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, TipTap 3 |
| Backend | Express 5, TypeScript, Prisma 6 |
| Database | PostgreSQL 15 |
| Queue | BullMQ 5 with Redis 7 |
| Storage | Cloudinary |
| Auth | Google OAuth 2.0, JWT |
| Email | Nodemailer via SMTP (Gmail, Outlook, Zoho, Yahoo, Custom) |
| Infra | Docker, Docker Compose |

---

## Project Structure

```
outly/
├── client/               
│   ├── src/
│   │   ├── app/            
│   │   │   ├── dashboard/   
│   │   │   │   ├── compose/   
│   │   │   │   ├── campaigns/  
│   │   │   │   └── templates
│   │   │   ├── login/      
│   │   │   └── ...             
│   │   ├── components/         
│   │   ├── hooks/          
│   │   ├── context/            
│   │   ├── lib/               
│   │   └── types/              
│   └── public/        
│
├── server/                     
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/             
│   │   ├── middlewares/       
│   │   ├── config/             
│   │   ├── queues/           
│   │   ├── utils/               
│   │   └── worker/           
│   ├── prisma/                
│   ├── Dockerfile        
│   ├── Dockerfile.worker    
│   └── docker-compose.yml      
│
└── docs/                      
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- Docker and Docker Compose (for local PostgreSQL and Redis)
- Google Cloud Console project (for OAuth Client ID)
- Cloudinary account (for attachment storage)

### 1. Clone and Install

```bash
git clone https://github.com/aniket1251/outly.git
```

```bash
cd outly
```

Server:

```bash
cd server
```

```bash
cp .env.example .env    # Fill in your values
```

```bash
npm install
```

Client:

```bash
cd ../client
```

```bash
npm install
```

```bash
cp .env.example .env    # Fill in your values
```

### 2. Start Infrastructure

```bash
cd server
```

```bash
docker compose up -d    # Starts PostgreSQL + Redis
```

### 3. Set Up Database

```bash
cd server
```

```bash
npm run prisma:generate
```

```bash
npx prisma migrate dev --name init
```

### 4. Start the Application

Terminal 1 (API Server):

```bash
cd server
```

```bash
npm run dev
```

Terminal 2 (Email Worker):

```bash
cd server
```

```bash
npm run worker
```

Terminal 3 (Frontend):

```bash
cd client
```

```bash
npm run dev
```

The app is now running at `http://localhost:3000`.

---

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Database connection string |
| `REDIS_URL` | Yes | Cache connection string |
| `ENCRYPTION_KEY` | Yes | Key for credential encryption |
| `JWT_ACCESS_SECRET` | Yes | Auth token secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token secret |
| `GOOGLE_CLIENT_ID` | Yes | Google sign-in Client ID |
| `CLOUDINARY_CLOUD_NAME` | Yes | File storage cloud name |
| `CLOUDINARY_API_KEY` | Yes | File storage API key |
| `CLOUDINARY_API_SECRET` | Yes | File storage API secret |
| `TRACKING_BASE_URL` | No | Public URL for tracking |
| `WORKER_CONCURRENCY` | No | Max parallel jobs |
| `MIN_DELAY_MS` | No | Min delay between sends |
| `WARMUP_DURATION_DAYS` | No | Warmup period length |

### Client (`client/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes | Google sign-in Client ID |

See `server/.env.example` and `client/.env.example` for all options with generation commands.

Full API documentation is available in [`API_REFERENCE.md`](API_REFERENCE.md).

---

## How It Works

**1. User signs in** with Google. The backend verifies the identity and creates an account.

**2. User adds a sender** by providing email credentials (Gmail App Password or custom provider). The system verifies the connection, securely stores the credentials, checks if the domain is properly set up for email delivery, and starts a gradual warmup process.

**3. User creates a campaign** with recipients (manual or CSV), subject, body, optional follow-up steps, attachments, business hours, and tracking preferences. Invalid recipients are filtered out, sending order is optimized for deliverability, and emails are queued for sending.

**4. The system processes emails** through a multi-step pipeline: validates the job, checks campaign state, verifies the sender, evaluates daily capacity and business hours, checks sending limits, securely retrieves credentials, downloads attachments, fills in template variables, adds tracking, prepares the email for deliverability, sends it, and updates status.

**5. The bounce and reply detector** monitors sender inboxes periodically. Bounces update email status, halt sequences, and block those recipients from future sends. Replies are detected and follow-up sequences stop automatically.

**6. The adaptive warmup** adjusts daily sending limits based on deliverability signals from the last 24 hours. Volume adjusts based on bounce rates, reply rates, and error rates.

**7. The follow-up scheduler** runs periodically, checks which recipients are due for their next follow-up, creates new emails with proper threading, and queues them for sending.

**8. Tracking events** are recorded when recipients open emails or click links. Metrics are available on the campaign detail page.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
