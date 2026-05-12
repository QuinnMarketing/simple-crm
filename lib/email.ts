import nodemailer from 'nodemailer'

export interface SmtpConfig {
  host: string
  port: string
  user: string
  pass: string
  from?: string
}

export async function sendEmail(config: SmtpConfig, to: string, subject: string, body: string) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: parseInt(config.port, 10) || 587,
    secure: parseInt(config.port, 10) === 465,
    auth: { user: config.user, pass: config.pass },
  })
  await transporter.sendMail({
    from: config.from || config.user,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  })
}
