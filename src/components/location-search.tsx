"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import { buttonClass, cn } from "./ui";

// Search box that accepts an address / postcode / neighborhood, or the
// browser's current location. Navigates to /sitters with the result.
export function LocationSearch({
  defaultValue = "",
  extraParams,
  size = "lg",
}: {
  defaultValue?: string;
  extraParams?: Record<string, string>;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  function go(params: Record<string, string>) {
    const qs = new URLSearchParams({ ...extraParams, ...params });
    router.push(`/sitters?${qs}`);
  }

  function useMyLocation() {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Your browser can't share its location. Type your area instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        go({
          lat: pos.coords.latitude.toFixed(4),
          lng: pos.coords.longitude.toFixed(4),
          near: "Your location",
        });
      },
      () => {
        setLocating(false);
        setError("We couldn't get your location. Type your area or postcode instead.");
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <div className="w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const v = input.current?.value.trim() ?? "";
          if (v) go({ near: v });
          else input.current?.focus();
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-full border border-line-strong bg-surface p-1.5 shadow-card",
          "focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15",
        )}
      >
        <MapPin size={20} className="ml-3 shrink-0 text-ink-3" aria-hidden />
        <label htmlFor="near" className="sr-only">
          Your address, postcode or neighborhood
        </label>
        <input
          ref={input}
          id="near"
          name="near"
          defaultValue={defaultValue === "Your location" ? "" : defaultValue}
          placeholder={defaultValue === "Your location" ? "Using your location" : "Address, postcode or neighborhood"}
          autoComplete="street-address"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-3 focus:outline-none",
            size === "lg" ? "h-11 text-base" : "h-9 text-[15px]",
          )}
        />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
          aria-label="Use my current location"
          title="Use my current location"
        >
          <Crosshair size={20} className={locating ? "animate-pulse" : undefined} />
        </button>
        <button type="submit" className={buttonClass("primary", size === "lg" ? "lg" : "md", "shrink-0")}>
          <MagnifyingGlass size={18} weight="bold" aria-hidden />
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>
      {error && <p className="mt-2 px-4 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
