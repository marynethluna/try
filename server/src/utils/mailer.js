import { ApiError } from '../utils/ApiError.js';

/**
 * Sends transactional email.
 *
 * - In development (no SMTP configured) the message is logged to the server
 *   console so the reset link can still be used end to end.
 * - In production, set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS and install
 *   the optional `nodemailer` package (`npm install nodemailer --prefix server`).
 */
let transporterPromise = null;

async function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporterPromise) {
    transporterPromise = import('nodemailer')
      .then(({ default: nodemailer }) => {
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth:
            process.env.SMTP_USER && process.env.SMTP_PASS
              ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
              : undefined,
        });
      })
      .catch(() => {
        throw new ApiError(500, 'Email delivery is not configured on this server. Contact the administrator.');
      });
  }
  return transporterPromise;
}

export async function sendMail({ to, subject, text, html }) {
  const transporter = await getTransporter().catch((error) => {
    console.error('[mailer]', error.message);
    return null;
  });

  if (!transporter) {
    // Development fallback — never leak credentials, only the message body.
    console.log('\n───────────── EMAIL (development console fallback) ─────────────');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log('───────────────────────────────────────────────────────────────\n');
    return { delivered: false };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'School Inventory System <no-reply@cvsu.edu.ph>',
    to,
    subject,
    text,
    html,
  });
  return { delivered: true };
}
