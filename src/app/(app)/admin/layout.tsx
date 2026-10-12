import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUser(["ADMIN"]);
  const [pendingSitters, disputes] = await Promise.all([
    db.user.count({ where: { role: "SITTER", status: "PENDING_REVIEW" } }),
    db.booking.count({ where: { status: "DISPUTED" } }),
  ]);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
      <AdminNav counts={{ "/admin/sitters": pendingSitters, "/admin/disputes": disputes }} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
