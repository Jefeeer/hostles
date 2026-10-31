"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadProof } from "./actions";

const sel = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base dark:bg-input/30";

/** Phone photos are often 3–10 MB; shrink images to ≤2000px JPEG before upload. */
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1_200_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function UploadForm({ token, suggested }: { token: string; suggested: number }) {
  const [state, action, pending] = useActionState(uploadProof.bind(null, token), undefined);
  const [preparing, setPreparing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={async (e) => {
        // Swap in a smaller copy of large photos, then submit.
        const input = fileRef.current;
        const f = input?.files?.[0];
        if (!f || f.size < 1_200_000 || preparing) return;
        e.preventDefault();
        setPreparing(true);
        const small = await shrink(f);
        const dt = new DataTransfer();
        dt.items.add(small);
        input!.files = dt.files;
        setPreparing(false);
        formRef.current?.requestSubmit();
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount sent (₱)</Label>
          <Input id="amount" name="amount" inputMode="decimal" defaultValue={suggested || ""} required className="tabular h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="method">Paid via</Label>
          <select id="method" name="method" defaultValue="gcash" className={sel}>
            <option value="gcash">GCash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reference">Reference no. (optional)</Label>
        <Input id="reference" name="reference" className="h-11 text-base" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="file">Screenshot or receipt</Label>
        <input ref={fileRef} id="file" name="file" type="file" required accept="image/*,application/pdf"
          className="block w-full rounded-lg border border-dashed p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-semibold" />
        <p className="text-xs text-muted-foreground">JPG, PNG, HEIC or PDF, up to 4 MB.</p>
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">Thank you! Your proof was sent. You&apos;ll get a receipt once it&apos;s verified.</p>}
      <Button type="submit" size="lg" disabled={pending || preparing} className="h-12 w-full text-base font-semibold sm:w-auto sm:px-10">
        {preparing ? "Preparing photo…" : pending ? "Uploading…" : "Send payment proof"}
      </Button>
    </form>
  );
}
