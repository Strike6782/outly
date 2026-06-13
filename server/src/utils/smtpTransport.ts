import nodemailer, { Transporter } from "nodemailer";

/**
 * Build a Nodemailer transporter for a sender's SMTP credentials.
 * Port 465 uses implicit TLS; other ports (e.g. Fastmail 587) use STARTTLS.
 */
export function createSmtpTransporter(config: {
  smtpHost: string;
  smtpPort: number;
  email: string;
  password: string;
  loginEmail?: string | null;
}): Transporter {
  const isSecure = config.smtpPort === 465;
  const authUser = config.loginEmail?.trim() || config.email;

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: isSecure,
    auth: {
      user: authUser,
      pass: config.password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
}
