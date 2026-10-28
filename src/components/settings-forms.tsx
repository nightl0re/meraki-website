"use client";

import { useActionState, useState } from "react";
import { Camera } from "@phosphor-icons/react";
import type { FormState } from "@/app/actions/auth";
import { changePassword, updateAccount, uploadAvatar } from "@/app/actions/account";
import { saveAvailability, updateSitterProfile } from "@/app/actions/sitter";
import { WEEKDAYS, formatMinutes } from "@/lib/format";
import { config } from "@/lib/config";
import { shrinkImage } from "@/lib/shrink-image";
import { SubmitButton } from "./submit-button";
import { Alert, Avatar, Field, Input, Select, Textarea, cn } from "./ui";

function Status({ state }: { state: FormState }) {
  if (state.error) return <Alert>{state.error}</Alert>;
  if (state.ok && state.message) return <Alert tone="accent">{state.message}</Alert>;
  return null;
}

export function AvatarForm({ user }: { user: { firstName: string; lastName: string; avatarUrl: string | null } }) {
  const [state, action] = useActionState<FormState, FormData>(uploadAvatar, {});
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar src={preview ?? user.avatarUrl} first={user.firstName} last={user.lastName} size={80} />
      <div className="flex-1 space-y-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm hover:border-ink-3">
          <Camera size={18} aria-hidden />
          Choose photo
          <input
            type="file"
            name="photo"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const input = e.currentTarget;
              const f = input.files?.[0];
              if (!f) return setPreview(null);
              // Resize in the browser so large phone photos fit the 2 MB limit.
              const small = await shrinkImage(f, 800).catch(() => f);
              const dt = new DataTransfer();
              dt.items.add(small);
              input.files = dt.files;
              setPreview(URL.createObjectURL(small));
            }}
          />
        </label>
        <p className="text-xs text-ink-3">A clear, friendly photo of your face. Large photos are resized automatically.</p>
        {preview && <SubmitButton size="sm" pendingText="Uploading">Save photo</SubmitButton>}
        <Status state={state} />
      </div>
    </form>
  );
}

export function AccountForm({ user }: { user: { firstName: string; lastName: string; phone: string; area: string; email: string } }) {
  const [state, action] = useActionState<FormState, FormData>(updateAccount, {});
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  const v = state.values ?? user;
  return (
    <form action={action} className="space-y-4">
      <Status state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={err("firstName")}>
          <Input id="firstName" name="firstName" defaultValue={v.firstName} autoComplete="given-name" />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={err("lastName")}>
          <Input id="lastName" name="lastName" defaultValue={v.lastName} autoComplete="family-name" />
        </Field>
      </div>
      <Field label="Email" htmlFor="email" hint="Contact support to change your email.">
        <Input id="email" value={user.email} disabled readOnly />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone" error={err("phone")}>
          <Input id="phone" name="phone" type="tel" defaultValue={v.phone} autoComplete="tel" />
        </Field>
        <Field label="Neighborhood or postcode" htmlFor="area" error={err("area")} hint="Used for sitters near you.">
          <Input id="area" name="area" defaultValue={v.area} autoComplete="postal-code" />
        </Field>
      </div>
      <SubmitButton pendingText="Saving">Save changes</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="space-y-4" key={state.ok ? "done" : "form"}>
      <Status state={state} />
      <Field label="Current password" htmlFor="current" error={err("current")}>
        <Input id="current" name="current" type="password" autoComplete="current-password" />
      </Field>
      <Field label="New password" htmlFor="password" error={err("password")} hint="At least 10 characters, with a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton variant="secondary" pendingText="Updating">Change password</SubmitButton>
    </form>
  );
}

type SitterProfileProps = {
  profile: {
    headline: string; bio: string; hourlyRate: string; experienceYears: number; maxChildren: number;
    serviceRadiusKm: number; area: string; skills: number[]; languages: string; cprCertified: boolean;
  };
  allSkills: { id: number; name: string }[];
};

export function SitterProfileForm({ profile, allSkills }: SitterProfileProps) {
  const [state, action] = useActionState<FormState, FormData>(updateSitterProfile, {});
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  const v = state.values;
  const [bio, setBio] = useState(v?.bio ?? profile.bio);
  return (
    <form action={action} className="space-y-5">
      <Status state={state} />
      <Field label="Headline" htmlFor="headline" error={err("headline")} hint="One line families see in search, e.g. “Former teacher, great with toddlers”.">
        <Input id="headline" name="headline" maxLength={120} defaultValue={v?.headline ?? profile.headline} />
      </Field>
      <Field label="About you" htmlFor="bio" error={err("bio")} hint={`${bio.length}/2000. Experience, what a typical evening with you looks like, certifications.`}>
        <Textarea id="bio" name="bio" rows={6} maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={`Hourly rate (${config.currency})`} htmlFor="hourlyRate" error={err("hourlyRate")}>
          <Input id="hourlyRate" name="hourlyRate" type="number" step="0.5" min={10} max={100} inputMode="decimal" defaultValue={v?.hourlyRate ?? profile.hourlyRate} />
        </Field>
        <Field label="Years of experience" htmlFor="experienceYears" error={err("experienceYears")}>
          <Input id="experienceYears" name="experienceYears" type="number" min={0} max={60} defaultValue={v?.experienceYears ?? profile.experienceYears} />
        </Field>
        <Field label="Max children at once" htmlFor="maxChildren">
          <Select id="maxChildren" name="maxChildren" defaultValue={v?.maxChildren ?? String(profile.maxChildren)}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Home neighborhood or postcode" htmlFor="area" error={err("area")} hint="Families see the neighborhood and distance only.">
          <Input id="area" name="area" defaultValue={v?.area ?? profile.area} />
        </Field>
        <Field label="How far will you travel?" htmlFor="serviceRadiusKm">
          <Select id="serviceRadiusKm" name="serviceRadiusKm" defaultValue={v?.serviceRadiusKm ?? String(profile.serviceRadiusKm)}>
            {[3, 5, 8, 10, 15, 20, 30].map((n) => <option key={n} value={n}>Up to {n} km</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Languages you speak" htmlFor="languages" error={err("languages")} hint="Separate with commas, e.g. English, Spanish">
          <Input id="languages" name="languages" maxLength={120} defaultValue={v?.languages ?? profile.languages} />
        </Field>
        <label className="flex items-center gap-3 self-end rounded-[10px] border border-line-strong px-4 py-3">
          <input type="checkbox" name="cprCertified" defaultChecked={profile.cprCertified} className="size-4 accent-[var(--accent)]" />
          <span className="text-sm"><span className="font-semibold">I hold a current CPR / first-aid certificate</span><br /><span className="text-ink-3">We may ask to see it.</span></span>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-ink-2">Skills</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {allSkills.map((s) => (
            <label key={s.id} className="cursor-pointer">
              <input type="checkbox" name="skills" value={s.id} defaultChecked={profile.skills.includes(s.id)} className="peer sr-only" />
              <span className="inline-flex h-9 items-center rounded-full border border-line-strong px-3.5 text-sm transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-strong peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                {s.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton pendingText="Saving">Save profile</SubmitButton>
    </form>
  );
}

const TIMES = Array.from({ length: 49 }, (_, i) => i * 30); // 0:00 .. 24:00

export function AvailabilityForm({ windows }: { windows: { weekday: number; start: number; end: number }[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveAvailability, {});
  const [on, setOn] = useState(() => WEEKDAYS.map((_, d) => windows.some((w) => w.weekday === d)));
  return (
    <form action={action} className="space-y-4">
      <Status state={state} />
      <ul className="divide-y divide-line rounded-xl border border-line">
        {WEEKDAYS.map((day, d) => {
          const w = windows.find((x) => x.weekday === d);
          return (
            <li key={day} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <label className="flex w-36 items-center gap-2.5 font-medium">
                <input
                  type="checkbox"
                  name={`on_${d}`}
                  checked={on[d]}
                  onChange={(e) => setOn((prev) => prev.map((x, i) => (i === d ? e.target.checked : x)))}
                  className="size-4 accent-[var(--accent)]"
                />
                {day}
              </label>
              <div className={cn("flex items-center gap-2", !on[d] && "pointer-events-none opacity-40")}>
                <label className="sr-only" htmlFor={`start_${d}`}>{day} start</label>
                <Select id={`start_${d}`} name={`start_${d}`} defaultValue={w?.start ?? 900} className="h-10 w-32">
                  {TIMES.slice(0, -2).map((t) => <option key={t} value={t}>{formatMinutes(t)}</option>)}
                </Select>
                <span className="text-sm text-ink-3">to</span>
                <label className="sr-only" htmlFor={`end_${d}`}>{day} end</label>
                <Select id={`end_${d}`} name={`end_${d}`} defaultValue={w?.end ?? 1320} className="h-10 w-32">
                  {TIMES.slice(2).map((t) => <option key={t} value={t}>{t === 1440 ? "Midnight" : formatMinutes(t)}</option>)}
                </Select>
              </div>
            </li>
          );
        })}
      </ul>
      <SubmitButton pendingText="Saving">Save availability</SubmitButton>
    </form>
  );
}
