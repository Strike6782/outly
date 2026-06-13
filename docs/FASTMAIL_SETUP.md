# Fastmail sender setup

This project uses [Outly](https://github.com/aniket1251/outly) with Fastmail support for cold email outreach on your own domains.

## 1. Create a Fastmail app password

1. Log in to [Fastmail](https://www.fastmail.com/)
2. Go to **Settings → Privacy & Security → App Passwords**
3. Create a new app password for "Outreach Tool"
4. Copy the password — you will not see it again

## 2. Add a sender in the dashboard

1. Open http://localhost:3100 and sign in with Google
2. Go to **Compose → Add Sender**
3. Select **Fastmail (custom domains)**
4. Enter your full address (e.g. `you@yourdomain.com`)
5. Paste the app password
6. Click **Add Sender**

The system verifies SMTP (`smtp.fastmail.com:587`) and stores IMAP settings (`imap.fastmail.com:993`) for automatic reply detection.

## 3. Recommended architecture

| Role | Service |
|------|---------|
| Receive replies | Fastmail inbox (IMAP) |
| Send campaigns | Fastmail SMTP for testing only, or Amazon SES/Postmark for production |
| Reply detection | Automatic via IMAP worker (every 15 min) |

**Warning:** Fastmail Terms of Service prohibit bulk cold email. For production outreach, send via Amazon SES or Postmark on your domains and keep Fastmail as the reply inbox only.

## 4. Production sending limits

Default limits for Fastmail senders in this setup:

- **Daily limit:** 25 emails per sender
- **Warmup:** 5 → 25 emails/day over 14 days
- **Reply detector:** polls every 15 minutes

Adjust in the sender settings or via `FASTMAIL_DAILY_LIMIT` in server config.

## 5. Multiple domains / aliases

Add **one sender per From address** in Outly (+ → Add Sender Account).

For **aliases** and custom-domain addresses on the same Fastmail account:

1. In Fastmail: **Settings → My email addresses** — ensure the alias exists and can **send** mail (verify if prompted).
2. In Outly when adding the sender:
   - **Email Address:** the alias (e.g. `outreach@yourdomain.com`)
   - **Fastmail login email:** your **primary** Fastmail address (e.g. `you@fastmail.com`)
   - **App password:** same app password as for your main account (Mail/IMAP+SMTP scope)

Fastmail only accepts your primary account email for SMTP/IMAP login; the From header can still be your alias.
