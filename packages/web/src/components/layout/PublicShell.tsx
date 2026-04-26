"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

declare global {
  interface Window {
    KodyConfig?: {
      siteId: string;
      serverUrl?: string;
    };
    Kody?: { open(): void; close(): void; destroy(): void };
  }
}

const KODY_SERVER_URL = process.env.NEXT_PUBLIC_KODY_API_URL || "http://localhost:3456";

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) return;

    window.KodyConfig = {
      siteId: "kody-website",
      serverUrl: KODY_SERVER_URL,
    };

    const existing = document.querySelector("script[data-kody-widget]");
    if (existing) return;

    const script = document.createElement("script");
    script.src = `${KODY_SERVER_URL}/widget.js?v=${Date.now()}`;
    script.async = true;
    script.setAttribute("data-kody-widget", "true");
    document.body.appendChild(script);

    return () => {
      window.Kody?.destroy();
      script.remove();
    };
  }, [isAdmin]);

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <main className="pt-16">{children}</main>
      <Footer />
    </>
  );
}
