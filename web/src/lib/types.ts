// Row types mirroring supabase/migrations. Kept by hand until a hosted project
// exists; then swap for `supabase gen types typescript`.

export const BOOKING_STATUSES = [
  "inquiry", "on_hold", "contract_sent", "signed", "deposit_paid", "fully_paid", "done", "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const EVENT_TYPES = ["wedding", "debut", "birthday", "corporate", "vo_project", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const PAYMENT_KINDS = ["deposit", "balance", "other"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_METHODS = ["gcash", "bank_transfer", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentStatus = "unpaid" | "partial" | "paid" | "n/a";

export type Client = {
  id: string;
  full_name: string;
  partner_name: string | null;
  email: string | null;
  phone: string | null;
  facebook: string | null;
  city: string | null;
  pronunciation_notes: string | null;
  story: string | null;
  program_notes: string | null;
  notes: string | null;
  created_at: string;
};

export type Package = {
  id: string;
  name: string;
  event_type: EventType | null;
  description: string | null;
  inclusions: string[];
  rate: number;
  hours: number | null;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
};

export type Booking = {
  id: string;
  no: number;
  ref: string;
  client_id: string;
  title: string | null;
  event_type: EventType;
  event_date: string; // yyyy-MM-dd, Manila
  start_time: string | null; // HH:mm:ss, Manila
  end_time: string | null;
  venue: string | null;
  venue_address: string | null;
  package_id: string | null;
  rate: number;
  deposit_amount: number;
  status: BookingStatus;
  status_changed_at: string;
  hold_expires_at: string | null;
  cancelled_reason: string | null;
  source: string;
  coordinator: string | null;
  guest_count: number | null;
  notes: string | null;
  google_event_id: string | null;
  google_synced_at: string | null;
  created_at: string;
};

export type Contract = {
  id: string;
  booking_id: string;
  template_id: string | null;
  template_version: number | null;
  title: string;
  body: string;
  status: "sent" | "signed" | "void";
  expires_at: string;
  viewed_at: string | null;
  signer_name: string | null;
  signature_text: string | null;
  signature_image: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  content_hash: string | null;
  created_at: string;
};

export type EmailTemplate = { key: string; name: string; description: string | null; subject: string; body: string; enabled: boolean };

export type BookingFinancials = {
  booking_id: string;
  paid: number;
  balance: number;
  payment_status: PaymentStatus;
};

/** Booking joined with client, package and money: what every list/view renders. */
export type BookingRow = Booking & {
  client: Pick<Client, "id" | "full_name" | "partner_name" | "phone" | "email"> | null;
  package: Pick<Package, "id" | "name"> | null;
  fin: BookingFinancials;
};

export type Payment = {
  id: string;
  booking_id: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amount: number;
  paid_on: string;
  reference: string | null;
  proof_path: string | null;
  verified_at: string | null;
  notes: string | null;
  submitted_by: "admin" | "client";
  proof_content_type: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: number;
  at: string;
  actor: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string | null;
  details: Record<string, unknown>;
};

export type SheetColumn = { key: string; label: string; visible: boolean };

export type MonthTotals = {
  bookings: number;
  cancelled: number;
  expected: number;
  collected: number;
  outstanding: number;
};
export type MonthSummary = {
  current: MonthTotals;
  prev: MonthTotals;
  last_year: MonthTotals;
  busiest: { date: string; count: number }[];
  by_type: Partial<Record<EventType, number>>;
};
