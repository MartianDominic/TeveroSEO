/**
 * Client branding API functions.
 *
 * Phase 16 Plan 04: Branding settings UI and report branding injection.
 */

/**
 * Client branding data from API.
 */
export interface ClientBranding {
  id?: string;
  clientId: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  footerText: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Default Tevero branding values.
 */
export const DEFAULT_BRANDING: Omit<ClientBranding, "id" | "createdAt" | "updatedAt"> = {
  clientId: "",
  logoUrl: null,
  primaryColor: "#3b82f6", // Tevero blue
  secondaryColor: "#10b981", // Tevero green
  footerText: null,
};

/**
 * Fetch branding for a client.
 * Returns Tevero defaults if no custom branding exists.
 */
export async function getBranding(clientId: string): Promise<ClientBranding> {
  const res = await fetch(`/api/clients/${clientId}/branding`);
  if (!res.ok) {
    // Return defaults on error
    return { ...DEFAULT_BRANDING, clientId, createdAt: null, updatedAt: null };
  }
  return res.json();
}

/**
 * Update branding data for input.
 */
export interface BrandingUpdateInput {
  primaryColor?: string;
  secondaryColor?: string;
  footerText?: string | null;
}

/**
 * Update branding for a client (colors, footer text).
 */
export async function updateBranding(
  clientId: string,
  data: BrandingUpdateInput,
): Promise<ClientBranding> {
  const res = await fetch(`/api/clients/${clientId}/branding`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.error ?? "Failed to update branding");
  }
  return res.json();
}

/**
 * Upload logo for a client.
 *
 * @param clientId - Client UUID
 * @param file - Logo file (PNG, JPG, SVG; max 2MB)
 * @returns Updated branding with logoUrl
 */
export async function uploadLogo(
  clientId: string,
  file: File,
): Promise<{ logoUrl: string; message: string }> {
  const formData = new FormData();
  formData.append("logo", file);

  const res = await fetch(`/api/clients/${clientId}/branding/logo`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error ?? "Failed to upload logo");
  }
  return res.json();
}

/**
 * Delete logo for a client.
 */
export async function deleteLogo(clientId: string): Promise<void> {
  const res = await fetch(`/api/clients/${clientId}/branding/logo`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.error ?? "Failed to delete logo");
  }
}

/**
 * Reset branding to Tevero defaults.
 */
export async function resetBranding(clientId: string): Promise<void> {
  const res = await fetch(`/api/clients/${clientId}/branding`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Reset failed" }));
    throw new Error(err.error ?? "Failed to reset branding");
  }
}
