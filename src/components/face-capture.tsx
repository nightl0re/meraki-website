"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle, LockSimple, UploadSimple, ArrowCounterClockwise } from "@phosphor-icons/react";
import { uploadIdPhoto } from "@/app/actions/sitter";
import type { FormState } from "@/app/actions/auth";
import { shrinkImage } from "@/lib/shrink-image";
import { Alert, buttonClass } from "./ui";

// Verification ("face ID") photo: take a selfie with the camera, or upload
// one. The photo is private: only the sitter and Meraki admins can open it.
export function FaceCapture({ savedUrl }: { savedUrl: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(uploadIdPhoto, {});
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "camera" | "preview">("idle");
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stopCamera, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function openCamera() {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
      stream.current = s;
      setMode("camera");
      // The <video> mounts on the next render.
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
      });
    } catch {
      setError("We couldn't open your camera. Allow camera access in your browser, or upload a photo instead.");
    }
  }

  async function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d")!;
    // Mirror back so the saved photo isn't flipped like the live preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    stopCamera();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (blob) await acceptPhoto(blob);
  }

  async function acceptPhoto(source: Blob) {
    setError("");
    try {
      const file = await shrinkImage(source);
      setPreview({ url: URL.createObjectURL(file), file });
      setMode("preview");
    } catch {
      setError("That image couldn't be read. Try a JPG or PNG photo.");
    }
  }

  function save() {
    if (!preview) return;
    const fd = new FormData();
    fd.set("photo", preview.file);
    startTransition(() => action(fd));
  }

  const showSaved = savedUrl && mode === "idle";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[240px_1fr]">
        <div className="relative aspect-[3/4] w-full max-w-[240px] overflow-hidden rounded-2xl border border-line bg-surface-2">
          {mode === "camera" && (
            <>
              <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
              <div className="pointer-events-none absolute inset-[12%] rounded-[50%] border-2 border-dashed border-white/80" aria-hidden />
            </>
          )}
          {mode === "preview" && preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the photo about to be uploaded
            <img src={preview.url} alt="Your verification photo, not saved yet" className="h-full w-full object-cover" />
          )}
          {showSaved && (
            // eslint-disable-next-line @next/next/no-img-element -- private photo served by /files/[id]
            <img src={savedUrl} alt="Your saved verification photo" className="h-full w-full object-cover" />
          )}
          {!showSaved && mode === "idle" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-ink-3">
              <Camera size={36} aria-hidden />
              No photo yet
            </div>
          )}
        </div>

        <div className="space-y-3 text-sm text-ink-2">
          <p className="font-semibold text-ink">How to take a good verification photo</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Face the camera, in good light, with your whole face visible.</li>
            <li>No sunglasses, hats or filters.</li>
            <li>If you can, hold your ID card (IC or passport) next to your face.</li>
          </ul>
          <p className="flex items-start gap-2 rounded-xl bg-info-soft p-3 text-info">
            <LockSimple size={18} className="mt-0.5 shrink-0" aria-hidden />
            Private: only Meraki&apos;s review team sees this photo. It&apos;s never shown to families.
          </p>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && mode === "idle" && <Alert tone="accent"><CheckCircle size={16} weight="fill" className="mr-1 inline" aria-hidden />{state.message}</Alert>}

      <div className="flex flex-wrap gap-2">
        {mode === "camera" ? (
          <>
            <button type="button" onClick={snap} className={buttonClass("primary")}><Camera size={18} aria-hidden />Take photo</button>
            <button type="button" onClick={() => { stopCamera(); setMode("idle"); }} className={buttonClass("ghost")}>Cancel</button>
          </>
        ) : mode === "preview" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => { save(); setMode("idle"); setPreview(null); }}
              className={buttonClass("primary")}
            >
              {pending ? "Saving" : "Use this photo"}
            </button>
            <button type="button" onClick={() => { setPreview(null); setMode("idle"); }} className={buttonClass("ghost")}>
              <ArrowCounterClockwise size={18} aria-hidden />Retake
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={openCamera} className={buttonClass("primary")}>
              <Camera size={18} aria-hidden />{savedUrl ? "Retake with camera" : "Take a selfie"}
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass("secondary")}>
              <UploadSimple size={18} aria-hidden />Upload a photo
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="user"
              className="sr-only"
              aria-label="Upload a verification photo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void acceptPhoto(f);
              }}
            />
          </>
        )}
      </div>
      {pending && <p className="text-sm text-ink-3">Uploading your photo...</p>}
    </div>
  );
}
