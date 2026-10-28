import type { Metadata } from 'next';
import { isAdmin } from '@/lib/auth';
import { getContent } from '@/lib/content';
import AdminEditor from '@/components/admin/AdminEditor';
import LoginForm from '@/components/admin/LoginForm';
import './admin.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin — Lester Events Host', robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <LoginForm />;
  return <AdminEditor initial={await getContent()} />;
}
