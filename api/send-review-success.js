
/* eslint-disable no-undef */
import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const { email, name, event } = req.body
  try {
    const result = await sendEmail({ to: email, name, event })
    return res.status(200).json(result)
  } catch (err) {
    console.error('Error sending registration email:', err)
    return res.status(500).json({ message: 'Failed to send email' })
  }
}

async function sendEmail({ to, name, event }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })

  console.log(`📨 Sending email to ${to} for event "${event}"`)

  await transporter.sendMail({
    from: `"UniVent" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Your Event is now live! -"${event}"`,
    text: `Dear ${name},

Congratulations! Your event "${event}" has been successfully reviewed and is now live on the UniVent platform.
Students can now discover and register for your event.

Track Your Event: https://univent.website/settings

Best regards,
The UniVent Team`,
  })

  console.log('✅ Email sent')
}
