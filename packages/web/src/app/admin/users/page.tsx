"use client";

import { useEffect, useState } from "react";
import { fetchUsers, createUser, deleteUser } from "@/lib/api";

interface AdminUser {
  id: number;
  email: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add user form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data as AdminUser[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddingUser(true);

    try {
      await createUser(newEmail.trim(), newPassword);
      setNewEmail("");
      setNewPassword("");
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create user";
      if (message.includes("409") || message.toLowerCase().includes("exists")) {
        setAddError("A user with this email already exists.");
      } else {
        setAddError(message);
      }
    } finally {
      setAddingUser(false);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!window.confirm(`Delete user "${user.email}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteUser(String(user.id));
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      if (message.includes("400") || message.toLowerCase().includes("own account")) {
        alert("You cannot delete your own account.");
      } else {
        alert(message);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage admin users for the Kody dashboard.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Add user form */}
      <div className="rounded-xl border border-border bg-background p-5">
        <h3 className="mb-4 text-base font-semibold">Add User</h3>
        <form onSubmit={handleAddUser} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="newEmail" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <button
            type="submit"
            disabled={addingUser}
            className="shrink-0 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {addingUser ? "Adding..." : "Add User"}
          </button>
        </form>
        {addError && (
          <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {addError}
          </p>
        )}
      </div>

      {/* Users table */}
      {users.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">No users found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Created At</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:border-red-800 dark:text-red-400"
                    >
                      Delete
                    </button>
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
