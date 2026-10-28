'use client';
import { useActionState } from 'react';
import { login } from '@/app/admin/actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="admin-login">
      <form action={action}>
        <p className="eyebrow">Admin · Demo</p>
        <h1>Sign in</h1>
        <label>Password<input name="password" type="password" autoComplete="current-password" required autoFocus /></label>
        <button className="btn" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
        {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
      </form>
    </main>
  );
}
