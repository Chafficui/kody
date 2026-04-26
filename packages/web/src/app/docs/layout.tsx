"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const sidebarLinks = [
  { href: "/docs/getting-started", label: "Getting Started" },
  { href: "/docs/configuration", label: "Configuration" },
  { href: "/docs/security", label: "Security" },
  { href: "/docs/ticket-providers", label: "Ticket Providers" },
  { href: "/docs/knowledge-sources", label: "Knowledge Sources" },
  { href: "/docs/self-hosting", label: "Self-Hosting" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-6xl px-4 py-8 sm:px-6">
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-primary p-3 text-white shadow-lg lg:hidden"
        aria-label="Toggle documentation sidebar"
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 z-30 h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-background p-4 transition-transform lg:sticky lg:translate-x-0 lg:border-r-0 lg:bg-transparent lg:p-0 lg:pr-8 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav>
          <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Documentation
          </h3>
          <ul className="space-y-1">
            {sidebarLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
