import Link from "next/link";
import Image from "next/image";
import icon from "../../public/brand/meraki-icon.png";

// The Meraki mark (mother and child) with the rounded coral wordmark, taken
// from the original app's logo.
export function Logo({ href = "/", size = 36 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Meraki home">
      <Image src={icon} alt="" width={size} height={size} priority className="rounded-[22%] shadow-sm" />
      <span className="font-display text-[22px] font-bold leading-none tracking-tight text-brand">Meraki</span>
    </Link>
  );
}
