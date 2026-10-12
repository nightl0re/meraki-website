import { CaretDown } from "@phosphor-icons/react/ssr";

// Native <details> accordion: accessible and works without JavaScript.
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((f) => (
        <details key={f.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
            {f.q}
            <CaretDown size={18} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-3 text-ink-2">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
