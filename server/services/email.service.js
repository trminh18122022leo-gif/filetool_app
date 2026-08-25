'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter && process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html }) {
  const mailer = getTransporter();
  if (!mailer) {
    console.log(`[Email Simulation]\nTo: ${to}\nSubject: ${subject}\nContent: ${html.replace(/<[^>]+>/g, '').slice(0, 150)}...`);
    return;
  }

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || '"FileTools Pro" <noreply@filetools.pro>',
    to,
    subject,
    html,
  });
}

async function sendVerificationEmail(email, token) {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await sendMail({
    to: email,
    subject: 'Xác thực tài khoản FileTools Pro',
    html: `<h2>Chào mừng bạn đến với FileTools Pro!</h2><p>Nhấn vào link dưới đây để kích hoạt tài khoản:</p><p><a href="${url}">${url}</a></p>`,
  });
}

async function sendPasswordResetEmail(email, token) {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await sendMail({
    to: email,
    subject: 'Đặt lại mật khẩu FileTools Pro',
    html: `<h2>Yêu cầu đặt lại mật khẩu</h2><p>Nhấn vào link dưới đây để đổi mật khẩu (có hiệu lực 1 giờ):</p><p><a href="${url}">${url}</a></p>`,
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
