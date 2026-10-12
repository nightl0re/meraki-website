import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-3">
            Verified babysitters in your neighborhood. You only pay once the job is done.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Parents</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-3">
            <li><Link className="hover:text-ink" href="/sitters">Find a sitter</Link></li>
            <li><Link className="hover:text-ink" href="/about">About us and how it works</Link></li>
            <li><Link className="hover:text-ink" href="/#pricing">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium">Sitters</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-3">
            <li><Link className="hover:text-ink" href="/about/sitters">How Meraki works for sitters</Link></li>
            <li><Link className="hover:text-ink" href="/signup?role=sitter">Become a sitter</Link></li>
            <li><Link className="hover:text-ink" href="/login">Log in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-ink-3 sm:px-6">
          © {new Date().getFullYear()} Meraki. Payments in this build are simulated; no real cards are charged.
        </p>
      </div>
    </footer>
  );
}
