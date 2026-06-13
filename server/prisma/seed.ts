import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed provider rate-limit profiles used by the throttle engine.
 * Fastmail uses conservative limits suitable for cold outreach volumes.
 */
async function main(): Promise<void> {
  const profiles = [
    {
      providerName: "Gmail",
      smtpHostPattern: "smtp.gmail.com",
      perMinuteLimit: 5,
      perHourLimit: 80,
      perDayLimit: 500,
    },
    {
      providerName: "Outlook",
      smtpHostPattern: "smtp.office365.com",
      perMinuteLimit: 5,
      perHourLimit: 80,
      perDayLimit: 500,
    },
    {
      providerName: "Fastmail",
      smtpHostPattern: "smtp.fastmail.com",
      perMinuteLimit: 2,
      perHourLimit: 15,
      perDayLimit: 25,
    },
    {
      providerName: "Default",
      smtpHostPattern: "*",
      perMinuteLimit: 3,
      perHourLimit: 30,
      perDayLimit: 100,
    },
  ];

  for (const profile of profiles) {
    await prisma.providerProfile.upsert({
      where: { smtpHostPattern: profile.smtpHostPattern },
      create: profile,
      update: profile,
    });
  }

  console.log("Provider profiles seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
