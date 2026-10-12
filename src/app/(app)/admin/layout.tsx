import { requireUser } from "@/lib/auth";

// Navigation for admins lives in the shared sidebar; this layout only guards
// the section (each page and action also checks the role itself).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUser(["ADMIN"]);
  return children;
}
