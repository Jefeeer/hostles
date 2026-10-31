'use client';
import { useActionState, useState } from 'react';
import type { Site } from '@/lib/site';
import { submitInquiry } from '@/app/(portal)/book/actions';

// Sends the inquiry straight into the portal as a new lead (same action as /book).
export default function InquiryForm({ inquiry }: { inquiry: Site['inquiry'] }) {
  const [state, action, pending] = useActionState(submitInquiry, undefined);
  const [type, setType] = useState('');
  const [loadedAt] = useState(() => Date.now());
  const timeLabel = type === 'Wedding' ? 'Start time of ceremony' : 'Target start time of program';

  if (state?.ok) {
    return (
      <p id="inquiry-status" role="status" aria-live="polite">
        Thank you! Your inquiry is in. {state.held ? 'Your date is on hold while Lester gets back to you.' : 'Lester will check the date and get back to you.'} A confirmation is on its way to your email.
      </p>
    );
  }

  return (
    <form id="inquiry-form" action={action}>
      {/* Bot traps: a field humans never see, and the time the form was opened. */}
      <input type="hidden" name="t" value={loadedAt} />
      <div aria-hidden="true" style={{ position: 'absolute', left: -9999 }}>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="row">
        <label>Name<input name="full_name" autoComplete="name" minLength={2} maxLength={120} required /></label>
        <label>Email<input name="email" type="email" autoComplete="email" maxLength={160} required /></label>
      </div>
      <label>Type of event
        <select name="event_type" required value={type} onChange={e => setType(e.target.value)}>
          <option value="">Select one</option>
          {inquiry.eventTypes.map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <div className="row">
        <label>Date<input name="event_date" type="date" required /></label>
        <label>Venue<input name="venue" maxLength={120} required /></label>
      </div>
      <label><span id="time-label">{timeLabel}</span><input name="start_time" type="time" required /></label>
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Sending…' : inquiry.submitLabel}</button>
      <p id="inquiry-status" role="status" aria-live="polite">{state?.error}</p>
    </form>
  );
}
