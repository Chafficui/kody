import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchSites, deleteSite } from "@/lib/api";

interface SiteSummary {
  siteId: string;
  enabled: boolean;
  branding: { name: string };
}

export default function SitesPage() {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSites();
  }, []);

  async function loadSites() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSites();
      setSites(data as SiteSummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(siteId: string) {
    if (!window.confirm(`Delete site "${siteId}"? This cannot be undone.`)) return;
    try {
      await deleteSite(siteId);
      setSites((prev) => prev.filter((s) => s.siteId !== siteId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete site");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Loading sites...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sites</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your Kody site configurations.</p>
        </div>
        <Link
          to="/sites/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors hover:bg-primary-dark"
        >
          Create New Site
        </Link>
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {sites.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">No sites configured yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Get started by creating your first site.</p>
          <Link
            to="/sites/new"
            className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors hover:bg-primary-dark"
          >
            Create New Site
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Site ID</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sites.map((site) => (
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
                    <div className="inline-flex gap-2">
                      <Link
                        to={`/sites/${site.siteId}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(site.siteId)}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:border-red-800 dark:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
