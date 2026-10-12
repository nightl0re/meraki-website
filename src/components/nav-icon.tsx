"use client";

import {
  Bell, Briefcase, CalendarBlank, ChartBar, CheckCircle, CreditCard, Gear, Heart, House, Info,
  MagnifyingGlass, Scales, User, Users, UsersThree, Wallet,
} from "@phosphor-icons/react";
import type { IconName } from "@/lib/nav";

const ICONS = {
  home: House, search: MagnifyingGlass, calendar: CalendarBlank, briefcase: Briefcase, heart: Heart,
  family: UsersThree, card: CreditCard, bell: Bell, gear: Gear, wallet: Wallet, user: User,
  check: CheckCircle, scales: Scales, users: Users, chart: ChartBar, info: Info,
} satisfies Record<IconName, unknown>;

export function NavIcon({ name, active, size = 20 }: { name: IconName; active?: boolean; size?: number }) {
  const Icon = ICONS[name];
  return <Icon size={size} weight={active ? "fill" : "regular"} aria-hidden />;
}
