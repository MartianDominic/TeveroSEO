"use client";

import { useState, useEffect } from "react";

import { useAuth } from "@clerk/nextjs";

import { apiGet } from "@/lib/api-client";

/**
 * Platform health status derived from configured secrets.
 */
export type PlatformHealth = "ok" | "partial" | "none";

/**
 * Fetches /api/platform-secrets/status and derives platform health.
 * - "ok": All required secrets are configured
 * - "partial": Some secrets configured
 * - "none": No secrets configured
 */
export const usePlatformHealth = (): PlatformHealth => {
  const { isSignedIn } = useAuth();
  const [health, setHealth] = useState<PlatformHealth>("none");

  useEffect(() => {
    if (!isSignedIn) return;
    apiGet<Array<{ key_name: string; required: boolean; configured: boolean }>>(
      "/api/platform-secrets/status"
    )
      .then((data) => {
        // Standard required keys (excludes dataforseo keys which are all required:false now)
        const standardRequired = data.filter((s) => s.required);
        const standardConfigured = standardRequired.filter(
          (s) => s.configured
        ).length;

        // DataForSEO: either (login + password) or base_code counts as one satisfied slot
        const login = data.find((s) => s.key_name === "dataforseo_login");
        const password = data.find((s) => s.key_name === "dataforseo_password");
        const baseCode = data.find(
          (s) => s.key_name === "dataforseo_base_code"
        );
        const dataforseoOk =
          (login?.configured && password?.configured) || baseCode?.configured;

        // Total slots = standard required + dataforseo-as-a-service
        const totalSlots = standardRequired.length + 1;
        const configuredSlots = standardConfigured + (dataforseoOk ? 1 : 0);

        if (configuredSlots === totalSlots) setHealth("ok");
        else if (configuredSlots > 0) setHealth("partial");
        else setHealth("none");
      })
      .catch(() => {
        // silent fail - don't break the shell on network errors
      });
  }, [isSignedIn]);

  return health;
};
