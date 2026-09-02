/* eslint-disable no-undef */
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { requireAuth } from './auth.js'
import { sendPushToUser } from './push-utils.js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SERVICE_ROLE_KEY)
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
  const auth = await requireAuth(req, res)
  if (!auth.ok) return
  const { email, rejectionReason } = req.body
  if (!email || !rejectionReason) {
    return res.status(400).json({ message: 'email and rejectionReason are required' })
  }
  try {
    await sendEmail({ to: email, message: rejectionReason })

    // --- Push notification: event rejected ---
    try {
      const { data: profile } = await supabaseAdmin
        .from('profile')
        .select('id')
        .eq('user_email', email)
        .maybeSingle()
      if (profile?.id) {
        await sendPushToUser(profile.id, {
          title: `❌ Event not approved`,
          body: `Your event submission was not approved. Check your email for details and next steps.`,
          url: '/settings?tab=dashboard',
          tag: 'rejection',
        })
      }
    } catch (pushErr) {
      console.error('Push failed for rejection notification:', pushErr.message)
    }

    return res.status(200).json({ message: 'Rejection email sent' })
  } catch (err) {
    console.error('Error sending rejection email:', err)
    return res.status(500).json({ message: 'Failed to send email' })
  }
}
