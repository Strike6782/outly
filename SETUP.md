# Outreach Tool — Cold email with Fastmail

Self-hosted cold email outreach based on [Outly](https://github.com/aniket1251/outly), configured for **Fastmail** and custom domains.

## Features

- Web dashboard for campaigns and sequences
- SMTP sending via Fastmail (or Gmail)
- Automatic reply detection via IMAP
- Follow-up sequences with configurable day delays
- Auto-stop follow-ups when a prospect replies
- Conservative sending limits (25/day per Fastmail sender)

## Prerequisites

- Node.js 22+
- Docker Desktop (PostgreSQL + Redis)
- Google Cloud OAuth client (app login only)
- Fastmail account with custom domains
- Fastmail app-specific password per sender address

## Quick start

### 1. Start infrastructure

```powershell
cd server
docker compose up -d
```

PostgreSQL draait op **poort 5433** (niet 5432) om conflicten met een lokale PostgreSQL-installatie te vermijden.

### 2. Configure environment

```powershell
cd server
copy .env.example .env
# Edit .env — set ENCRYPTION_KEY, JWT secrets, GOOGLE_CLIENT_ID

cd ..\client
copy .env.example .env
# Set NEXT_PUBLIC_GOOGLE_CLIENT_ID (same as server)
```

Generate secrets:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice for `ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`.

### 3. Install and migrate

```powershell
cd server
npm install
npx prisma migrate dev --name init
npm run prisma:seed

cd ..\client
npm install
```

### 4. Run the application

Terminal 1 — API:

```powershell
cd server
npm run dev
```

Terminal 2 — Email worker (sends + reply detector):

```powershell
cd server
npm run worker
```

Terminal 3 — Frontend:

```powershell
cd client
npm run dev
```

Open http://localhost:3100

## Fastmail setup

See [docs/FASTMAIL_SETUP.md](docs/FASTMAIL_SETUP.md)

## DNS verification

```powershell
.\scripts\dns-check.ps1 -Domain yourdomain.com
```

See [docs/DNS_CHECK.md](docs/DNS_CHECK.md)

## Test campaign checklist

1. Add a Fastmail sender with app password
2. Import a CSV with `email`, `Name`, `Company` columns
3. Create campaign with follow-up steps (e.g. day 3, day 7)
4. Send test to your own address
5. Reply from that inbox — verify follow-ups are cancelled within 15 minutes

## Important warnings

- **Fastmail ToS:** bulk cold email is prohibited; use SES/Postmark for production sending
- **Volume:** default 25 emails/day per sender during warmup
- **Cloudinary:** optional; only needed for email attachments

## License

MIT (Outly upstream)
