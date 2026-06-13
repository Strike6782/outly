# Testcampagne checklist

Gebruik deze stappen om de volledige flow te verifiëren zodra je Google OAuth en Fastmail-credentials hebt ingesteld.

## Voorbereiding

1. Vul `GOOGLE_CLIENT_ID` in `server/.env` en `client/.env`
2. Start services (zie [SETUP.md](../SETUP.md))
3. Controleer DNS: `.\scripts\dns-check.ps1 -Domain jouwdomein.nl`

## Stappen

1. Open http://localhost:3100 en log in met Google
2. **Compose → Add Sender** → kies **Fastmail (custom domains)**
3. Voer je Fastmail-adres en app password in
4. Maak een campagne met `examples/test-campaign.csv` (of je eigen CSV met kolommen `email`, `Name`, `Company`)
5. Voeg follow-up stappen toe: bijv. dag 3 en dag 7
6. Stuur eerst naar je **eigen** testadres
7. Antwoord op de mail vanuit die inbox
8. Binnen 15 minuten moet Outly de reply detecteren en pending follow-ups annuleren

## Wat er automatisch gebeurt

| Component | Interval | Actie |
|-----------|----------|-------|
| Reply detector | 15 min | Pollt Fastmail IMAP, markeert replies, stopt sequences |
| Sequence scheduler | 15 min | Plant follow-ups na X dagen zonder reply |
| Email worker | realtime | Verstuurt via SMTP met threading headers |

## Verificatie in de database

```powershell
cd server
npx prisma studio
```

Controleer `EmailJob.isReplied` en `RecipientSequenceState.replied` na een testreply.
