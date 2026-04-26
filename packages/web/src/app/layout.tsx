import type { Metadata } from "next";
import PublicShell from "@/components/layout/PublicShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kody — AI Chat Assistant for Your Website",
  description:
    "Add an AI assistant to your website in 60 seconds. Open source, fully customizable, self-hosted.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
