import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import SitesPage from "@/pages/Sites";
import SiteCreatePage from "@/pages/SiteCreate";
import SiteEditPage from "@/pages/SiteEdit";
import LogsPage from "@/pages/Logs";
import UsersPage from "@/pages/Users";

const sidebarLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/sites", label: "Sites" },
  { to: "/users", label: "Users" },
  { to: "/logs", label: "Logs" },
];

function Layout() {
  const { pathname } = useLocation();
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = "/admin/login";
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-muted/40">
        <div className="flex h-16 items-center px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="text-xl">K</span>
            Kody
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {sidebarLinks.map((link) => {
            const isActive =
              link.to === "/" ? pathname === "/" : pathname.startsWith(link.to);

            return (
              <Link
                key={link.to}
                to={link.to}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
          <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Logout
          </button>
        </header>

        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sites" element={<SitesPage />} />
            <Route path="/sites/new" element={<SiteCreatePage />} />
            <Route path="/sites/:siteId" element={<SiteEditPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<Layout />} />
      </Routes>
    </AuthProvider>
  );
}
