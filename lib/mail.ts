import nodemailer from "nodemailer";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type Attachment = { filename: string; content: Buffer | Uint8Array };

export const ILO_EMAIL = () => process.env.ILO_EMAIL || "moffat.muga@gmail.com";

/**
 * Sends an email. If SMTP_HOST is not configured (local testing), the message
 * is written to ./outbox instead so you can inspect it.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments?: Attachment[];
}) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    const dir = path.join(process.cwd(), "outbox");
    await mkdir(dir, { recursive: true });
    const stamp = `${Date.now()}-${opts.to.replace(/[^a-z0-9@.]/gi, "_")}`;
    await writeFile(
      path.join(dir, `${stamp}.txt`),
      `To: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}\n\nAttachments: ${(opts.attachments ?? []).map((a) => a.filename).join(", ")}\n`,
    );
    for (const a of opts.attachments ?? []) {
      await writeFile(path.join(dir, `${stamp}-${a.filename}`), a.content);
    }
    return;
  }
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || `RTVC Industrial Liaison <${process.env.SMTP_USER}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    attachments: (opts.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content),
    })),
  });
}
