
/* eslint-disable no-undef */
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { requireAuth } from './auth.js'
import { sendPushToUser } from './push-utils.js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SERVICE_ROLE_KEY)

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
    await sendEmail({ to: email, name, event })

    // --- Push notification: event is now live ---
    try {
      const { data: profile } = await supabaseAdmin
        .from('profile')
        .select('id')
        .eq('user_email', email)
        .maybeSingle()
      if (profile?.id) {
        const title = typeof event === 'string' ? event : event?.event_title || 'your event'
        await sendPushToUser(profile.id, {
          title: `🎉 Your event is now live!`,
          body: `"${title}" has been approved and is now visible to students on UniVent.`,
          url: '/settings?tab=dashboard',
          tag: `review-success-${event?.id || ''}`,
        })
      }
    } catch (pushErr) {
      console.error('Push failed for review success:', pushErr.message)
    }

    return res.status(200).json({ message: 'Review success email sent' })
  } catch (err) {
    console.error('Error sending review success email:', err)
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

  const title = typeof event === 'string' ? event : event?.event_title || 'your event'

  await transporter.sendMail({
    from: `"UniVent" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Your Event is now live! - ${title}`,
    text: `Dear ${name || 'there'},

Congratulations! Your event "${title}" has been successfully reviewed and is now live on the UniVent platform.
Students can now discover and register for your event.

Track Your Event: https://univent.website/settings

Best regards,
The UniVent Team`,
  })
}
