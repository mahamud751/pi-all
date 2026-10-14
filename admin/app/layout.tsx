import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "PlaceIn — Property Management", description: "Agency and head office management platform" };

const themeScript = `try{var t=localStorage.getItem("placein-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body suppressHydrationWarning>{children}</body></html>;
}
