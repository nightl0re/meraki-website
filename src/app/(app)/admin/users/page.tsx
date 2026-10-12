import type { Metadata } from "next";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { setUserStatus } from "@/app/actions/admin";
import { Avatar, Badge, Card, Input, PageHeader, Select, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const role = (["PARENT", "SITTER", "ADMIN"] as Role[]).find((r) => r === sp.role);

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role;
  if (q) where.OR = [{ email: { contains: q } }, { firstName: { contains: q } }, { lastName: { contains: q } }];

  const users = await db.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <>
      <PageHeader title="Users" />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">Search</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Name or email" className="h-10 max-w-xs" />
        <label htmlFor="role" className="sr-only">Role</label>
        <Select id="role" name="role" defaultValue={role ?? ""} className="h-10 w-40">
          <option value="">All roles</option>
          <option value="PARENT">Parents</option>
          <option value="SITTER">Sitters</option>
          <option value="ADMIN">Admins</option>
        </Select>
        <button className={buttonClass("secondary")}>Filter</button>
      </form>
      <Card className="divide-y divide-line">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
            <Avatar src={u.avatarUrl} first={u.firstName} last={u.lastName} size={36} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{u.firstName} {u.lastName}</p>
              <p className="truncate text-sm text-ink-3">{u.email}, joined {formatShortDate(u.createdAt)}</p>
            </div>
            <Badge>{u.role.toLowerCase()}</Badge>
            <Badge tone={u.status === "ACTIVE" ? "info" : u.status === "SUSPENDED" ? "danger" : "warn"}>
              {u.status.toLowerCase().replace("_", " ")}
            </Badge>
            {u.role !== "ADMIN" && u.id !== admin.id && (u.status === "ACTIVE" || u.status === "SUSPENDED") && (
              <form action={setUserStatus}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="status" value={u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                <button className={buttonClass(u.status === "ACTIVE" ? "danger" : "secondary", "sm")}>
                  {u.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                </button>
              </form>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
