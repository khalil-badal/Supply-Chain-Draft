import nodemailer from 'nodemailer';

// Dev-friendly transport: streams the full email content (headers + body) to
// the console instead of actually sending anything, since no real SMTP
// credentials exist yet. Swap this for a real transport by filling in
// SMTP_HOST/PORT/USER/PASS in .env and switching to nodemailer.createTransport
// with those values - the sendMail() call site below does not need to change.
const transport = nodemailer.createTransport({
  streamTransport: true,
  newline: 'unix',
  buffer: true
});

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

// Sends via real SMTP when SMTP_HOST is configured; skips silently otherwise.
// Used by scheduled jobs where a missing SMTP config is not an error.
export async function sendMailReal(msg: MailMessage): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!process.env.SMTP_HOST) return { ok: true, skipped: true };
  const realTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  try {
    await realTransport.sendMail({
      from: process.env.SMTP_FROM || 'Microgenesis Supply Chain Portal <no-reply@microgenesis.example>',
      to: msg.to,
      subject: msg.subject,
      text: msg.text
    });
    return { ok: true };
  } catch (err) {
    console.error('[SMTP sendMailReal]', err);
    return { ok: false };
  }
}

export async function sendMail(msg: MailMessage): Promise<{ ok: boolean; info?: string }> {
  try {
    const result = await transport.sendMail({
      from: process.env.SMTP_FROM || 'Microgenesis Supply Chain Portal <no-reply@microgenesis.example>',
      to: msg.to,
      subject: msg.subject,
      text: msg.text
    });
    const body = result.message ? result.message.toString() : '';
    console.log('--- [MOCK EMAIL] ---------------------------------------');
    console.log(body || `To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}`);
    console.log('----------------------------------------------------------');
    return { ok: true };
  } catch (err) {
    console.error('Failed to log mock email:', err);
    return { ok: false };
  }
}
