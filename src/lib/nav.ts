import type { Role } from "@prisma/client";

// Single source for the signed-in navigation (sidebar + mobile menu), modelled
// on the desktop app's left-hand menu for each role.

export type IconName =
  | "home" | "search" | "calendar" | "briefcase" | "heart" | "family" | "card" | "bell" | "gear"
  | "wallet" | "user" | "check" | "scales" | "users" | "chart" | "info";

export type NavItem = { href: string; label: string; icon: IconName; badge?: NavBadge };
export type NavBadge = "bookingsAction" | "jobApplicants" | "jobsNear" | "requests" | "notifications" | "pendingSitters" | "disputes";

export function navFor(role: Role): NavItem[] {
  if (role === "PARENT") {
    return [
      { href: "/parent", label: "Home", icon: "home" },
      { href: "/sitters", label: "Find a babysitter", icon: "search" },
      { href: "/bookings", label: "My bookings", icon: "calendar", badge: "bookingsAction" },
      { href: "/jobs", label: "My job posts", icon: "briefcase", badge: "jobApplicants" },
      { href: "/favorites", label: "Saved sitters", icon: "heart" },
      { href: "/parent/family", label: "Family profile", icon: "family" },
      { href: "/settings/payment", label: "Payment methods", icon: "card" },
      { href: "/notifications", label: "Notifications", icon: "bell", badge: "notifications" },
      { href: "/settings", label: "Settings", icon: "gear" },
    ];
  }
  if (role === "SITTER") {
    return [
      { href: "/sitter", label: "Home", icon: "home" },
      { href: "/sitter/jobs", label: "Find jobs", icon: "briefcase", badge: "jobsNear" },
      { href: "/bookings", label: "My bookings", icon: "calendar", badge: "requests" },
      { href: "/sitter/earnings", label: "Earnings", icon: "wallet" },
      { href: "/sitter/profile", label: "My profile", icon: "user" },
      { href: "/notifications", label: "Notifications", icon: "bell", badge: "notifications" },
      { href: "/settings", label: "Settings", icon: "gear" },
    ];
  }
  return [
    { href: "/admin", label: "Overview", icon: "chart" },
    { href: "/admin/sitters", label: "Sitter approvals", icon: "check", badge: "pendingSitters" },
    { href: "/admin/disputes", label: "Disputes", icon: "scales", badge: "disputes" },
    { href: "/admin/bookings", label: "Bookings", icon: "calendar" },
    { href: "/admin/payouts", label: "Payouts", icon: "wallet" },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/notifications", label: "Notifications", icon: "bell", badge: "notifications" },
    { href: "/settings", label: "Settings", icon: "gear" },
  ];
}
