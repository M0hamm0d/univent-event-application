/* eslint-disable no-undef */
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req) {
  const { email, name, event } = await req.json();
  const result = await sendEmail({ to: email, name, event });
  return NextResponse.json(result);
}


async function sendEmail({ to, name, event }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  console.log(`📨 Sending email to ${to} for event "${event.event_title}"`);

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
  });

  console.log('✅ Email sent');
}
