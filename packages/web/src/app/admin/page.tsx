"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSites } from "@/lib/api";

interface SiteSummary {
  siteId: string;
  enabled: boolean;
  branding: { name: string };
}

export default function AdminDashboardPage() {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSites()
      .then((data) => setSites(data as SiteSummary[]))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const activeSites = sites.filter((s) => s.enabled);
  const recentSites = sites.slice(-5).reverse();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your Kody installation.</p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Sites</p>
          <p className="mt-2 text-3xl font-bold">{sites.length}</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm font-medium text-muted-foreground">Active Sites</p>
          <p className="mt-2 text-3xl font-bold text-primary">{activeSites.length}</p>
        </div>

        <Link
          href="/admin/sites/new"
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background p-6 transition-colors hover:border-primary hover:bg-muted/40"
        >
          <span className="text-3xl text-muted-foreground">+</span>
          <span className="mt-1 text-sm font-medium text-muted-foreground">Create New Site</span>
        </Link>
      </div>

      {/* Recent sites */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Sites</h3>
          <Link href="/admin/sites" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        {recentSites.length === 0 ? (
          <div className="rounded-xl border border-border bg-background p-8 text-center">
            <p className="text-muted-foreground">
              No sites yet.{" "}
              <Link href="/admin/sites/new" className="font-medium text-primary hover:underline">
                Create your first site
              </Link>
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Site ID</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentSites.map((site) => (
                  <tr key={site.siteId} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{site.siteId}</td>
                    <td className="px-4 py-3">{site.branding.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          site.enabled
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : "bg-red-500/10 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {site.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/sites/${site.siteId}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
