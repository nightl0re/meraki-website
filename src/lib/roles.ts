import type { Role } from "@prisma/client";

// Where each kind of account belongs. Babysitters who aren't approved yet
// (PENDING_REVIEW) only have their application page.

export const SITTER_APPLICATION = "/sitter/application";

export function isPendingSitter(user: { role: Role; status: string }) {
  return user.role === "SITTER" && user.status !== "ACTIVE";
}

export function homeFor(role: Role, status?: string) {
  if (role === "SITTER" && status && status !== "ACTIVE") return SITTER_APPLICATION;
  return role === "ADMIN" ? "/admin" : role === "SITTER" ? "/sitter" : "/parent";
}
