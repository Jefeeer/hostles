"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sign } from "./actions";

export function SignForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [state, action, pending] = useActionState(sign.bind(null, token), undefined);
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [name, setName] = useState(defaultName);
  const [image, setImage] = useState("");
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="signature_image" value={mode === "draw" ? image : ""} />

      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-11 text-base" />
        {err("name") && <p className="text-sm text-destructive">{err("name")}</p>}
      </div>

      <div className="space-y-2">
        <div role="radiogroup" aria-label="Signature type" className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {(["type", "draw"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className={cn("rounded-md px-3 py-1.5 font-medium", mode === m ? "bg-background shadow-xs" : "text-muted-foreground")}>
              {m === "type" ? "Type signature" : "Draw signature"}
            </button>
          ))}
        </div>
        {mode === "type" ? (
          <div className="space-y-1.5">
            <Label htmlFor="signature_text" className="sr-only">Typed signature</Label>
            <Input id="signature_text" name="signature_text" defaultValue={defaultName} placeholder="Type your name as your signature"
              className="h-14 font-serif text-2xl italic" />
          </div>
        ) : (
          <SignaturePad onChange={setImage} />
        )}
        {err("signature") && <p className="text-sm text-destructive">{err("signature")}</p>}
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="agree" className="mt-0.5 size-4 accent-[var(--brand)]" />
        I have read this agreement and agree to its terms. I understand this electronic signature is legally binding.
      </label>
      {err("agree") && <p className="text-sm text-destructive">{err("agree")}</p>}
      {state?.error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}

      <Button type="submit" size="lg" disabled={pending} className="h-12 w-full text-base font-semibold sm:w-auto sm:px-10">
        {pending ? "Signing…" : "Sign agreement"}
      </Button>
    </form>
  );
}

/** Finger/mouse signature canvas → PNG data URL. */
function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#17110c";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div>
      <canvas
        ref={ref}
        aria-label="Signature pad: draw your signature"
        className="h-40 w-full touch-none rounded-lg border-2 border-dashed bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(...pos(e));
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.lineTo(...pos(e));
          ctx.stroke();
          setEmpty(false);
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          onChange(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{empty ? "Sign with your finger or mouse" : "Looks good"}</span>
        <button type="button" className="font-medium hover:underline"
          onClick={() => {
            const c = ref.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setEmpty(true);
            onChange("");
          }}>
          Clear
        </button>
      </div>
    </div>
  );
}
