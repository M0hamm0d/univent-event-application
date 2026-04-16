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
    subject: `Event Submission Confirmation -"${event}"`,
    text: `Dear ${name},

Thank you for submitting ${event}. We’re pleased to confirm that your event has been successfully received.

Our team will review the details of your submission. If everything looks good and no issues are found, your event will automatically go live on the UniVent website for students to discover.

If we need any additional information or corrections, we will reach out to you via this email.

Best regards,
The UniVent Team`,
  })

  console.log('✅ Email sent')
}
