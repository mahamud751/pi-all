import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "PlaceIn — Property Management", description: "Agency and head office management platform" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning>{children}</body></html>;
}
