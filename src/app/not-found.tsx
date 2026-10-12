import Image from "next/image";
import icon from "../../public/brand/meraki-icon.png";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Image src={icon} alt="" width={96} height={96} className="rounded-[22%]" />
      <h1 className="mt-6 text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-sm text-ink-2">It may have moved, or the link might be incomplete.</p>
      <LinkButton href="/" className="mt-8">Back to home</LinkButton>
    </main>
  );
}
