/* eslint-disable no-undef */
import nodemailer from 'nodemailer'
import 'dotenv/config'
import { requireAuth } from './_lib/auth.js'
import { sendPushToUser } from './_lib/push-utils.js'
import { getSupabaseAdmin } from './_lib/supabase-admin.js'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const auth = await requireAuth(req, res)
  if (!auth.ok) return

  const { eventId, eventName, eventDate, transition } = req.body || {}

  if (!eventId) {
    return res.status(400).json({ message: 'eventId is required' })
  }
  if (transition !== 'announced' && transition !== 'undecided') {
    return res.status(400).json({ message: 'transition must be announced|undecided' })
  }

  try {
    const { data: event, error: eventError } = await getSupabaseAdmin()
      .from('events')
      .select('id, event_title, date, date_not_fixed')
      .eq('id', eventId)
      .maybeSingle()

    if (eventError) throw eventError
    if (!event) {
      return res.status(404).json({ message: 'Event not found' })
    }

    const dbUndecided = !!(event.date_not_fixed || event.date == null)
    if (transition === 'announced' && dbUndecided) {
      return res.status(409).json({ message: 'Event is still undated; cannot send announce email' })
    }
    if (transition === 'undecided' && !dbUndecided) {
      return res
        .status(409)
        .json({ message: 'Event still has a date; cannot send undecided email' })
    }

    const { data: registrations, error: regError } = await getSupabaseAdmin()
      .from('registered_events')
      .select(
        `
        user_id (
          id,
          user_name,
          user_email
        )
      `,
      )
      .eq('event_id', eventId)
      .eq('status', 'registered')

    if (regError) throw regError

    // Also notify waitlisted attendees — they may be promoted later and would
    // otherwise miss the date change entirely.
    const { data: waitlisted, error: waitError } = await getSupabaseAdmin()
      .from('waiting_list')
      .select(
        `
        user_id (
          id,
          user_name,
          user_email
        )
      `,
      )
      .eq('event_id', eventId)

    if (waitError) throw waitError

    const title = event.event_title || eventName || 'your event'
    const displayDate = event.date || eventDate || null

    let sent = 0
    const allRecipients = [
      ...(registrations || []).map((r) => r.user_id),
      ...(waitlisted || []).map((w) => w.user_id),
    ]
    const seen = new Set()
    for (const profile of allRecipients) {
      if (!profile || seen.has(profile.id)) continue
      seen.add(profile.id)
      const to = profile?.user_email
      const name = profile?.user_name || 'there'
      if (!to) continue

      const { subject, text } =
        transition === 'announced'
          ? {
              subject: `📅 Date announced for "${title}"`,
              text: `Hi ${name},

Good news — the date for "${title}", an event you registered for on UniVent, has just been announced.

Date: ${displayDate || 'TBA'}

Please check the event page for full details and add it to your calendar. We'll send you a reminder closer to the day.

Best regards,
The UniVent Team`,
            }
          : {
              subject: `⚠️ Date update for "${title}"`,
              text: `Hi ${name},

We wanted to let you know that the previously announced date for "${title}", an event you registered for on UniVent, is no longer confirmed.

The event date is currently undecided. The organizer will announce a new date as soon as it is confirmed, and you'll receive another notification then.

Your registration is still valid — no action is needed on your part.

Best regards,
The UniVent Team`,
            }

      try {
        await transporter.sendMail({
          from: `"UniVent" <${process.env.EMAIL_USER}>`,
          to,
          subject,
          text,
        })
        sent++
      } catch (err) {
        console.error(`Failed to email ${to} for event ${eventId}:`, err.message)
      }

      // --- Push notification: date announced or undecided ---
      try {
        const userId = profile.id
        if (userId) {
          const pushPayload =
            transition === 'announced'
              ? {
                  title: `📅 Date announced for ${title}`,
                  body: `The date for "${title}" is now set for ${displayDate || 'TBA'}. Check the event for details.`,
                  url: `/discover?modal=open&id=${eventId}`,
                  tag: `date-announced-${eventId}`,
                }
              : {
                  title: `⚠️ Date update for ${title}`,
                  body: `The previously announced date for "${title}" is no longer confirmed. You'll be notified when a new date is set.`,
                  url: `/discover?modal=open&id=${eventId}`,
                  tag: `date-undecided-${eventId}`,
                }
          await sendPushToUser(userId, pushPayload)
        }
      } catch (pushErr) {
        console.error(`Push failed for date change (user ${profile.id}):`, pushErr.message)
      }
    }

    return res.status(200).json({ sent, transition })
  } catch (err) {
    console.error('notify-date-change error:', err)
    return res.status(500).json({ message: err.message || 'Failed to send notifications' })
  }
}
