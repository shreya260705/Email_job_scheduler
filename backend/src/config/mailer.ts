import nodemailer from 'nodemailer';

let defaultTransporter: nodemailer.Transporter | null = null;
let etherealCredentials: { user: string; pass: string } | null = null;

export async function getMailerTransporter(senderUser?: string, senderPass?: string): Promise<nodemailer.Transporter> {
  // 1. Real SMTP (e.g. Gmail / SendGrid / Custom SMTP) if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    if (!defaultTransporter) {
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

      defaultTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: isSecure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log(`[Mailer] Using Real SMTP Server: ${process.env.SMTP_HOST} (${process.env.SMTP_USER})`);
    }
    return defaultTransporter;
  }

  // 2. Custom sender credentials
  if (senderUser && senderPass) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: senderUser,
        pass: senderPass,
      },
    });
  }

  // 3. Configured Ethereal credentials
  if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
    if (!defaultTransporter) {
      defaultTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER,
          pass: process.env.ETHEREAL_PASS,
        },
      });
      console.log(`[Mailer] Using configured Ethereal account: ${process.env.ETHEREAL_USER}`);
    }
    return defaultTransporter;
  }

  // 4. Fallback: Auto-generate Ethereal test account (Assignment Default)
  if (!defaultTransporter) {
    console.log('[Mailer] Generating dynamic Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    etherealCredentials = {
      user: testAccount.user,
      pass: testAccount.pass,
    };
    defaultTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[Mailer] Created Ethereal account: ${testAccount.user}`);
  }

  return defaultTransporter;
}

export function getEtherealPreviewUrl(info: any): string | false {
  return nodemailer.getTestMessageUrl(info);
}

export async function createNewSenderCredentials(): Promise<{ user: string; pass: string }> {
  const account = await nodemailer.createTestAccount();
  return {
    user: account.user,
    pass: account.pass,
  };
}
