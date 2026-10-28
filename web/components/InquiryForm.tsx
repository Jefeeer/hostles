'use client';
import { useState } from 'react';
import type { Site } from '@/lib/content';

// Opens the visitor's email app with a prepared message (no server-side sending).
export default function InquiryForm({ inquiry }: { inquiry: Site['inquiry'] }) {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [prepared, setPrepared] = useState('');
  const timeLabel = type === 'Wedding' ? 'Start time of ceremony' : 'Target start time of program';
  const email = inquiry.email.trim();
  const emailOk = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) && !/[\r\n?&#]/.test(email);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const subject = `${d.eventType} inquiry — ${d.name}`;
    const body = `Hello Lester,\n\nName: ${d.name}\nEmail: ${d.email}\nType of event: ${d.eventType}\nDate: ${d.date}\nVenue: ${d.venue}\n${timeLabel}: ${d.time}\n\nThank you!`;
    const text = `${emailOk ? `To: ${email}\n` : ''}Subject: ${subject}\n\n${body}`;
    setPrepared(text);
    if (emailOk) {
      location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setStatus('Your email app should open with this message ready to send. If it does not, copy the message below.');
    } else {
      try { await navigator.clipboard.writeText(text); setStatus('Inquiry copied. Paste it into a message to Lester on Facebook or Instagram.'); }
      catch { setStatus('Copy the message below and send it to Lester on Facebook or Instagram.'); }
    }
  }

  return (
    <form id="inquiry-form" onSubmit={submit}>
      <div className="row">
        <label>Name<input name="name" autoComplete="name" maxLength={100} required /></label>
        <label>Email<input name="email" type="email" autoComplete="email" maxLength={150} required /></label>
      </div>
      <label>Type of event
        <select name="eventType" required value={type} onChange={e => setType(e.target.value)}>
          <option value="">Select one</option>
          {inquiry.eventTypes.map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <div className="row">
        <label>Date<input name="date" type="date" required /></label>
        <label>Venue<input name="venue" maxLength={120} required /></label>
      </div>
      <label><span id="time-label">{timeLabel}</span><input name="time" type="time" required /></label>
      <button className="btn" type="submit">{inquiry.submitLabel}</button>
      <p id="inquiry-status" role="status" aria-live="polite">{status}</p>
      {prepared && <textarea id="prepared-inquiry" readOnly rows={8} value={prepared} aria-label="Your prepared inquiry" />}
    </form>
  );
}
