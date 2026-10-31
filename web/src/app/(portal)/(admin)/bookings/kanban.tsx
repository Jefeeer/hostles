"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Ellipsis, Search } from "lucide-react";
import { toast } from "sonner";
import { EventTypeTag } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PIPELINE, STATUS_LABEL } from "@/lib/constants";
import { fmtDate, php } from "@/lib/format";
import type { BookingRow, BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { moveBooking } from "./actions";

const COLUMNS: BookingStatus[] = [...PIPELINE, "cancelled"];

export function Kanban({ initial }: { initial: BookingRow[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [dragging, setDragging] = useState<BookingRow | null>(null);
  const [cancelling, setCancelling] = useState<BookingRow | null>(null);
  const [conflict, setConflict] = useState<{ b: BookingRow; to: BookingStatus; reasons: string[] } | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.title, r.venue, r.client?.full_name, r.ref].some((v) => v?.toLowerCase().includes(s)));
  }, [rows, q]);

  function move(b: BookingRow, to: BookingStatus, reason?: string, force = false) {
    if (b.status === to) return;
    if (to === "cancelled" && reason === undefined) return setCancelling(b);
    const from = b.status;
    const revert = () => setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, status: from } : r)));
    setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, status: to } : r)));
    startTransition(async () => {
      try {
        const res = await moveBooking(b.id, to, { reason, force });
        if (res.ok) return void toast.success(`${b.title ?? b.ref} → ${STATUS_LABEL[to]}`);
        revert();
        if (res.conflicts) setConflict({ b, to, reasons: res.conflicts });
        else toast.error(res.error ?? "Couldn't move that booking.");
      } catch {
        revert();
        toast.error("Couldn't move that booking. Try again.");
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const b = rows.find((r) => r.id === e.active.id);
    if (b && e.over) move(b, e.over.id as BookingStatus);
  }

  return (
    <>
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, venue, ref…" className="h-10 pl-9" aria-label="Search bookings" />
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setDragging(rows.find((r) => r.id === e.active.id) ?? null)}
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
      >
        {/* Horizontal scroll with snap on mobile; columns fit wider screens. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {COLUMNS.map((status) => (
            <Column key={status} status={status} rows={filtered.filter((r) => r.status === status)} onMove={move} />
          ))}
        </div>
        <DragOverlay>{dragging && <Card b={dragging} overlay />}</DragOverlay>
      </DndContext>

      <Dialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Possible double booking</DialogTitle>
            <DialogDescription>{conflict?.b.title} on {conflict && fmtDate(conflict.b.event_date, "EEE, MMM d")}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">{conflict?.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflict(null)}>Don&apos;t move</Button>
            <Button onClick={() => { if (conflict) move(conflict.b, conflict.to, undefined, true); setConflict(null); }}>Book anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CancelDialog
        booking={cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={(reason) => {
          if (cancelling) move(cancelling, "cancelled", reason);
          setCancelling(null);
        }}
      />
    </>
  );
}

function Column({ status, rows, onMove }: { status: BookingStatus; rows: BookingRow[]; onMove: (b: BookingRow, to: BookingStatus) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = rows.reduce((s, r) => s + r.rate, 0);
  return (
    <section
      ref={setNodeRef}
      aria-label={STATUS_LABEL[status]}
      className={cn(
        "flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border bg-muted/40 sm:w-[272px]",
        isOver && "border-brand bg-brand-soft/40",
        status === "cancelled" && "bg-transparent border-dashed",
      )}
    >
      <header className="flex items-baseline justify-between gap-2 px-3 pt-3 pb-2">
        <h2 className="text-sm font-bold">
          {STATUS_LABEL[status]} <span className="tabular ml-1 font-medium text-muted-foreground">{rows.length}</span>
        </h2>
        {status !== "cancelled" && total > 0 && <span className="tabular text-xs text-muted-foreground">{php(total)}</span>}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {rows.map((b) => <DraggableCard key={b.id} b={b} onMove={onMove} />)}
        {rows.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Drop here</p>}
      </div>
    </section>
  );
}

function DraggableCard({ b, onMove }: { b: BookingRow; onMove: (b: BookingRow, to: BookingStatus) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: b.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-30")}>
      <Card b={b} onMove={onMove} />
    </div>
  );
}

function Card({ b, overlay, onMove }: { b: BookingRow; overlay?: boolean; onMove?: (b: BookingRow, to: BookingStatus) => void }) {
  const holdExpired = b.status === "on_hold" && b.hold_expires_at && new Date(b.hold_expires_at) < new Date();
  return (
    <article className={cn("group relative rounded-lg border bg-card p-3 shadow-xs", overlay && "rotate-2 shadow-lg ring-2 ring-brand")}>
      <Link href={`/bookings/${b.id}`} className="block pr-7 after:absolute after:inset-0" draggable={false}>
        <p className="line-clamp-2 text-sm leading-snug font-semibold">{b.title ?? b.client?.full_name}</p>
      </Link>
      <p className="tabular mt-1 text-xs font-medium text-brand-deep dark:text-brand">{fmtDate(b.event_date, "EEE, MMM d, yyyy")}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <EventTypeTag type={b.event_type} />
        {b.rate > 0 && (
          <span className={cn("tabular text-xs font-semibold", b.fin.balance > 0 ? "text-foreground" : "text-emerald-700 dark:text-emerald-300")}>
            {b.fin.balance > 0 ? `${php(b.fin.balance)} due` : "Paid"}
          </span>
        )}
      </div>
      {holdExpired && <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">Hold expired</p>}
      {onMove && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="absolute top-2 right-2 z-10" aria-label={`Move ${b.title ?? "booking"}`}
              onPointerDown={(e) => e.stopPropagation()}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {PIPELINE.filter((s) => s !== b.status).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(b, s)}>{STATUS_LABEL[s]}</DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {b.status !== "cancelled" && (
              <DropdownMenuItem variant="destructive" onSelect={() => onMove(b, "cancelled")}>Cancel booking…</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </article>
  );
}

function CancelDialog({ booking, onClose, onConfirm }: { booking: BookingRow | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {booking?.title ?? "booking"}?</DialogTitle>
          <DialogDescription>It stays in your records as Cancelled. Payments already received are kept.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Keep booking</Button>
          <Button variant="destructive" onClick={() => { onConfirm(reason.trim()); setReason(""); }}>Cancel booking</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
