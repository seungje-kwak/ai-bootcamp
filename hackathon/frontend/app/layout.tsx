import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./v9.css";

export const metadata: Metadata = {
  title: "MyPace Jeju | Your Local Companion",
  description: "Explore Jeju on your terms: a personalized itinerary, local guidance, and thoughtful travel support.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#176d62",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="font-sans"><div className="app-shell">{children}</div></body></html>;
}
