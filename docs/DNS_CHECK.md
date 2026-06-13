# DNS check for outreach domains

Run this script before starting campaigns to verify SPF, DKIM, and DMARC records.

## Usage (PowerShell)

```powershell
.\scripts\dns-check.ps1 -Domain yourdomain.com
```

## What it checks

| Record | Purpose |
|--------|---------|
| SPF (TXT) | Authorizes mail servers to send on your behalf |
| DMARC (TXT `_dmarc`) | Tells receivers how to handle failed authentication |
| DKIM | Fastmail provides CNAME records in Settings → Domains |

## Fastmail DNS

In Fastmail **Settings → Domains**, use the interactive guide to configure:

- MX: `in1-smtp.messagingengine.com` (10), `in2-smtp.messagingengine.com` (20)
- SPF: `v=spf1 include:spf.messagingengine.com -all`
- Three DKIM CNAME records (copy from Fastmail dashboard)

If you use Amazon SES or Postmark for sending, merge their SPF includes with Fastmail's record (only one SPF TXT record per domain).

## Manual verification

```powershell
nslookup -type=txt yourdomain.com
nslookup -type=txt _dmarc.yourdomain.com
```

All checks should pass before sending cold outreach at scale.
