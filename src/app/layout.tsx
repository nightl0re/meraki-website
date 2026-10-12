import type { Metadata, Viewport } from "next";
import { Nunito, Quicksand } from "next/font/google";
import "./globals.css";

// Quicksand matches the rounded Meraki wordmark; Nunito is its friendly, readable body partner.
const quicksand = Quicksand({ variable: "--font-quicksand", subsets: ["latin"], weight: ["500", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Meraki · Trusted babysitters near you", template: "%s · Meraki" },
  description:
    "Find verified babysitters in your neighborhood. Book in minutes and pay only after the job is done.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${quicksand.variable} ${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg" suppressHydrationWarning>{children}</body>
    </html>
  );
}
