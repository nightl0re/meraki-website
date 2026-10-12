import { SiteHeader } from "@/components/site-header";
import { sweep } from "@/lib/bookings";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Expire stale requests and auto-confirm finished jobs before showing data.
  await sweep();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 md:py-12">{children}</main>
    </>
  );
}
