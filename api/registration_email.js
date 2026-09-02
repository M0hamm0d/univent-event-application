/* eslint-disable no-undef */
import nodemailer from 'nodemailer'
import 'dotenv/config'
import { requireAuth } from './_lib/auth.js'
import { sendPushToUser } from './_lib/push-utils.js'
import { getSupabaseAdmin } from './_lib/supabase-admin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const auth = await requireAuth(req, res)
  if (!auth.ok) return
  const { email, name, event } = req.body
  if (!email || !event) {
    return res.status(400).json({ message: 'email and event are required' })
  }
  try {
    const result = await sendEmail({ to: email, name, event })

    // --- Push notification: registration confirmed ---
    try {
      const { data: profile } = await getSupabaseAdmin()
        .from('profile')
        .select('id')
        .eq('user_email', email)
        .maybeSingle()
      if (profile?.id) {
        await sendPushToUser(profile.id, {
          title: `✅ Registered for ${event.event_title}`,
          body: `Your spot is confirmed! ${event.date ? event.date + ' at ' + (event.time || '') : ''}`,
          url: `/discover?modal=open&id=${event.id}`,
          tag: `registration-${event.id}`,
        })
      }
    } catch (pushErr) {
      console.error('Push failed for registration confirmation:', pushErr.message)
    }

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

  console.log(`📨 Sending email to ${to} for event "${event.event_title}"`)

  await transporter.sendMail({
    from: `"UniVent" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Event Registration Confirmation -"${event.event_title}"`,
    text: `Dear ${name},

Thank you for registering for ${event.event_title}. We’re pleased to confirm that your registration has been successfully received.

Here are your event details:

Event: ${event.event_title}
Date: ${event.date}
Time: ${event.time}
Location: ${event.location}

We’re excited to have you join us and look forward to your participation. If you have any questions or need further assistance, please feel free to reply to this email.

Best regards,
The UniVent Team`,
  })

  console.log('✅ Email sent')
}
