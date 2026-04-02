/* eslint-disable no-undef */
import nodemailer from 'nodemailer'
async function sendEmail({ to, message }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
  await transporter.sendMail({
    from: `"UniVent" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your Event Was Not Approved',
    text: `Hello,

      Thank you for submitting your event to our platform.

      Unfortunately, your event was not approved.

      ${message}

      You can review the issue and submit your event again

      We appreciate your understanding and your effort in sharing events with the community.

      Best regards,
      The UniVent Team`,
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const { email, rejectionReason } = req.body
  try {
    await sendEmail({ to: email, message: rejectionReason })
    return res.status(200).json({ message: 'Duplicate event notification sent' })
  } catch (err) {
    console.error('Error sending duplicate event notification:', err)
    return res.status(500).json({ message: 'Failed to send email' })
  }
}
