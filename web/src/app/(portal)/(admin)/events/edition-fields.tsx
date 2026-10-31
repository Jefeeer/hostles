import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_LABEL } from "@/lib/constants";
import type { Edition } from "@/lib/events";
import { EVENT_TYPES } from "@/lib/types";

export const STATUS_CHIP: Record<Edition["status"], string> = {
  planning: "bg-muted text-muted-foreground", open: "bg-brand-soft text-brand-ink",
  done: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100", cancelled: "bg-muted text-muted-foreground line-through",
};

const sel = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm dark:bg-input/30";

/** Inputs for an edition (inside an ActionForm bound to saveEdition). */
export function EditionFields({ e, series }: { e?: Edition; series: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <F label="Series" id="series_id">
        <select id="series_id" name="series_id" defaultValue={e?.series_id ?? series[0]?.id} className={sel}>
          {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </F>
      <F label="Edition name" id="name"><Input id="name" name="name" required defaultValue={e?.name} placeholder="Kasalang Tagaytay 2027" /></F>
      <F label="Date" id="event_date"><Input id="event_date" name="event_date" type="date" required defaultValue={e?.event_date} /></F>
      <div className="grid grid-cols-2 gap-2">
        <F label="Start" id="start_time"><Input id="start_time" name="start_time" type="time" defaultValue={e?.start_time?.slice(0, 5) ?? ""} /></F>
        <F label="End" id="end_time"><Input id="end_time" name="end_time" type="time" defaultValue={e?.end_time?.slice(0, 5) ?? ""} /></F>
      </div>
      <F label="Venue" id="venue"><Input id="venue" name="venue" defaultValue={e?.venue ?? ""} /></F>
      <div className="grid grid-cols-2 gap-2">
        <F label="Event type" id="event_type">
          <select id="event_type" name="event_type" defaultValue={e?.event_type ?? "wedding"} className={sel}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
          </select>
        </F>
        <F label="Status" id="status">
          <select id="status" name="status" defaultValue={e?.status ?? "planning"} className={sel}>
            {["planning", "open", "done", "cancelled"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </F>
      </div>
      <F label="Fee" id="fee_mode">
        <select id="fee_mode" name="fee_mode" defaultValue={e?.fee_mode ?? "flat"} className={sel}>
          <option value="flat">Flat fee for the whole event</option>
          <option value="per_entry">Per entry (e.g. per couple)</option>
        </select>
      </F>
      <div className="grid grid-cols-3 gap-2">
        <F label="Flat fee ₱" id="flat_fee"><Input id="flat_fee" name="flat_fee" inputMode="decimal" defaultValue={e?.flat_fee ?? ""} /></F>
        <F label="Flat paid ₱" id="flat_paid"><Input id="flat_paid" name="flat_paid" inputMode="decimal" defaultValue={e?.flat_paid ?? ""} /></F>
        <F label="Per entry ₱" id="per_entry_fee"><Input id="per_entry_fee" name="per_entry_fee" inputMode="decimal" defaultValue={e?.per_entry_fee ?? ""} /></F>
      </div>
      <div className="sm:col-span-2"><F label="Notes" id="notes"><Textarea id="notes" name="notes" rows={2} defaultValue={e?.notes ?? ""} /></F></div>
    </div>
  );
}

function F({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
