"use client";

/**
 * Superadmin Credentials Management Page
 *
 * Provides UI for managing API keys and secrets.
 * Only accessible to superadmin users.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

interface SecretDisplay {
  key: string;
  category: string;
  description: string;
  required: boolean;
  usedByServices: string[];
  isSet: boolean;
  maskedValue?: string;
  lastUpdated?: string;
  validationHint?: string;
  eitherOrGroup?: string;
  pairedWith?: string[];
}

interface CategoryGroup {
  category: string;
  label: string;
  icon: string;
  secrets: SecretDisplay[];
}

interface SecretsSummary {
  total: number;
  set: number;
  missing: number;
  requiredMissing: number;
}

interface SecretsResponse {
  success: boolean;
  data?: {
    categories: CategoryGroup[];
    summary: SecretsSummary;
  };
  error?: string;
}

export default function CredentialsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [summary, setSummary] = useState<SecretsSummary | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const fetchSecrets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/superadmin/secrets");
      const data: SecretsResponse = await res.json();

      if (!data.success) {
        setError(data.error ?? "Failed to load secrets");
        return;
      }

      setCategories(data.data?.categories ?? []);
      setSummary(data.data?.summary);
      // Expand categories with missing required secrets
      const toExpand = new Set<string>();
      for (const cat of data.data?.categories ?? []) {
        if (cat.secrets.some((s) => s.required && !s.isSet)) {
          toExpand.add(cat.category);
        }
      }
      setExpandedCategories(toExpand);
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchSecrets();
    }
  }, [isLoaded, isSignedIn, fetchSecrets]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleEdit = (key: string) => {
    setEditingKey(key);
    setEditValue("");
  };

  const handleSave = async () => {
    if (!editingKey) return;

    try {
      setSaving(true);
      const res = await fetch("/api/superadmin/secrets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editingKey, value: editValue }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to save");
        return;
      }

      setEditingKey(null);
      setEditValue("");
      await fetchSecrets();
    } catch (err) {
      setError("Failed to save secret");
    } finally {
      setSaving(false);
    }
  };

  const handleReveal = async (key: string) => {
    try {
      const res = await fetch("/api/superadmin/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, action: "reveal" }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to reveal");
        return;
      }

      setRevealedKey(key);
      setRevealedValue(data.data.value);

      // Auto-hide after 30 seconds
      setTimeout(() => {
        setRevealedKey(null);
        setRevealedValue(null);
      }, 30000);
    } catch (err) {
      setError("Failed to reveal secret");
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      // Could show a toast here
    } catch (err) {
      setError("Failed to copy to clipboard");
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/api/superadmin/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export" }),
      });

      if (!res.ok) {
        setError("Failed to export");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tevero-env-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export secrets");
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-lg">Loading credentials...</div>
      </div>
    );
  }

  if (error === "Unauthorized") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="max-w-md p-6 bg-gray-800 rounded-lg">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-300 mb-4">
            This page is only accessible to superadmin users.
          </p>
          <p className="text-gray-400 text-sm">
            To enable access, add your Clerk user ID to the SUPERADMIN_USER_IDS array
            in apps/web/src/lib/secrets/superadmin.ts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Credentials Management</h1>
            <p className="text-gray-400 mt-1">
              Manage API keys and secrets for TeveroSEO
            </p>
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Export .env
          </button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-3xl font-bold">{summary.total}</div>
              <div className="text-gray-400 text-sm">Total Secrets</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">{summary.set}</div>
              <div className="text-gray-400 text-sm">Configured</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-3xl font-bold text-yellow-400">
                {summary.missing}
              </div>
              <div className="text-gray-400 text-sm">Not Set</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div
                className={`text-3xl font-bold ${
                  summary.requiredMissing > 0 ? "text-red-400" : "text-green-400"
                }`}
              >
                {summary.requiredMissing}
              </div>
              <div className="text-gray-400 text-sm">Required Missing</div>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && error !== "Unauthorized" && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 text-sm underline mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Categories */}
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.category} className="bg-gray-800 rounded-lg overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat.category)}
                className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="font-semibold text-lg">{cat.label}</span>
                  <span className="text-gray-500 text-sm">
                    ({cat.secrets.filter((s) => s.isSet).length}/{cat.secrets.length})
                  </span>
                </div>
                <span
                  className={`transform transition-transform ${
                    expandedCategories.has(cat.category) ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {/* Secrets list */}
              {expandedCategories.has(cat.category) && (
                <div className="border-t border-gray-700">
                  {cat.secrets.map((secret) => (
                    <div
                      key={secret.key}
                      className="px-6 py-4 border-b border-gray-700/50 last:border-b-0"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm bg-gray-700 px-2 py-1 rounded">
                              {secret.key}
                            </code>
                            {secret.required && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                                Required
                              </span>
                            )}
                            {secret.isSet ? (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                                Set
                              </span>
                            ) : (
                              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                                Not Set
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm mt-1">
                            {secret.description}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            Used by: {secret.usedByServices.join(", ")}
                          </p>
                          {secret.validationHint && (
                            <p className="text-gray-500 text-xs mt-1">
                              Format: {secret.validationHint}
                            </p>
                          )}
                          {secret.eitherOrGroup && (
                            <p className="text-blue-400 text-xs mt-1">
                              Either/Or group: {secret.eitherOrGroup}
                            </p>
                          )}
                          {secret.pairedWith && secret.pairedWith.length > 0 && (
                            <p className="text-purple-400 text-xs mt-1">
                              Paired with: {secret.pairedWith.join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {/* Value display */}
                          {secret.isSet && (
                            <div className="flex items-center gap-2">
                              {revealedKey === secret.key && revealedValue ? (
                                <code className="font-mono text-xs bg-gray-700 px-2 py-1 rounded max-w-xs truncate">
                                  {revealedValue}
                                </code>
                              ) : (
                                <span className="text-gray-500 font-mono text-sm">
                                  {secret.maskedValue}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-1">
                            {secret.isSet && revealedKey !== secret.key && (
                              <button
                                onClick={() => handleReveal(secret.key)}
                                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                                title="Reveal"
                              >
                                👁️
                              </button>
                            )}
                            {secret.isSet && revealedKey === secret.key && revealedValue && (
                              <button
                                onClick={() => handleCopy(revealedValue)}
                                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                                title="Copy"
                              >
                                📋
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(secret.key)}
                              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                              title="Edit"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Edit form */}
                      {editingKey === secret.key && (
                        <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder={`Enter new value for ${secret.key}`}
                              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded transition-colors"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingKey(null);
                                setEditValue("");
                              }}
                              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                          <p className="text-gray-500 text-xs mt-2">
                            Leave empty to clear the secret
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
          <p className="text-gray-400 text-sm">
            All secrets are encrypted with AES-256-GCM before storage. Access is
            audit logged. After updating secrets, you may need to restart services
            for changes to take effect.
          </p>
        </div>
      </div>
    </div>
  );
}
