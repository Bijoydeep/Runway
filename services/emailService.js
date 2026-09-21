const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail(toEmail, code) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: `${code} is your Runway sign-in code`,
    text: `Your Runway sign-in code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px;">
        <h2 style="margin:0 0 12px;">Your sign-in code</h2>
        <p style="color:#555;">Enter this code in Runway to finish signing in. It expires in 10 minutes.</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:20px 0;">${code}</div>
        <p style="color:#999;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail };
