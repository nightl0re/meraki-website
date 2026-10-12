"use client";

import { buttonClass } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-ink-2">
        Sorry about that. No payment was taken because of this error. Please try again.
      </p>
      <button type="button" onClick={reset} className={buttonClass("primary", "md", "mt-8")}>Try again</button>
    </main>
  );
}
