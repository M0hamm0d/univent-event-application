/* eslint-disable no-undef */
import nodemailer from 'nodemailer'
async function sendEmail({ to }) {
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
    subject: 'Duplicate Event Notification',
    text: `Hello,

      Thank you for submitting your event to our platform.

      We noticed that the event you recently added appears to have already been submitted by another organizer earlier. To avoid duplicate listings and ensure the best experience for users, we were unable to publish your submission at this time.

      If you believe this was flagged in error or you have additional information to provide (such as a different session, update, or collaboration with the original organizer), please feel free to reply to this email and we will be happy to review it.

      We appreciate your understanding and your effort in sharing events with the community.

      Best regards,
      The UniVent Team`,
  })
}

export default async function handler(req, res) {
  console.log('This is req', req, 'and this is res', res)
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const { email } = req.body
  try {
    await sendEmail({ to: email })
    return res.status(200).json({ message: 'Duplicate event notification sent' })
  } catch (err) {
    console.error('Error sending duplicate event notification:', err)
    return res.status(500).json({ message: 'Failed to send email' })
  }
}
