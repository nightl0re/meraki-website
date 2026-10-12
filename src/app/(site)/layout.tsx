import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Public pages show live data (sitters, areas, reviews) and the signed-in
// header, so they render per request and are never prerendered at build time
// (the build server has no database).
export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
