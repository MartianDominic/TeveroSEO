"use client";

/**
 * useVariableValue Hook
 * Phase 57-03: Rich Text Inline Editing with TipTap
 *
 * Hook for resolving variable values from context.
 * Variables are resolved from a VariableContext provider that fetches
 * all variables for a proposal in a single request (avoiding N+1 queries).
 *
 * Pattern reference: RESEARCH.md Pattern 4 - Variable Resolution
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

/**
 * Resolved variable value.
 */
export interface ResolvedVariable {
  /** Variable key */
  key: string;
  /** Resolved value (formatted string) */
  value: string | null;
  /** Whether the variable was resolved successfully */
  isResolved: boolean;
  /** Raw value before formatting */
  rawValue: unknown;
  /** Format type (text, currency, date, number, percentage, list) */
  formatType?: string;
}

/**
 * Variable context value.
 */
export interface VariableContextValue {
  /** Map of variable keys to resolved values */
  variables: Map<string, ResolvedVariable>;
  /** Whether variables are still loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refetch variables */
  refetch: () => Promise<void>;
  /** Manually set a variable value */
  setVariable: (key: string, value: ResolvedVariable) => void;
}

/**
 * Default context value.
 */
const defaultContextValue: VariableContextValue = {
  variables: new Map(),
  isLoading: false,
  error: null,
  refetch: async () => {},
  setVariable: () => {},
};

/**
 * Variable context for providing resolved values.
 */
export const VariableContext = createContext<VariableContextValue>(defaultContextValue);

/**
 * Hook result.
 */
export interface UseVariableValueResult {
  /** Resolved value (formatted string) or null */
  value: string | null;
  /** Whether the variable was resolved successfully */
  isResolved: boolean;
  /** Whether resolution is in progress */
  isLoading: boolean;
  /** Raw value before formatting */
  rawValue: unknown;
}

/**
 * useVariableValue - Get resolved value for a variable key.
 *
 * @param key - Variable key (e.g., "client.companyName")
 * @returns Resolved value and status
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { value, isResolved } = useVariableValue("client.companyName");
 *
 *   return (
 *     <span className={!isResolved ? "text-red-500" : undefined}>
 *       {isResolved ? value : "Missing"}
 *     </span>
 *   );
 * }
 * ```
 */
export function useVariableValue(key: string): UseVariableValueResult {
  const context = useContext(VariableContext);

  // If no key provided, return empty result
  if (!key) {
    return {
      value: null,
      isResolved: false,
      isLoading: false,
      rawValue: undefined,
    };
  }

  // Get variable from context
  const variable = context.variables.get(key);

  // If context is loading, return loading state
  if (context.isLoading) {
    return {
      value: null,
      isResolved: false,
      isLoading: true,
      rawValue: undefined,
    };
  }

  // If variable found, return it
  if (variable) {
    return {
      value: variable.value,
      isResolved: variable.isResolved,
      isLoading: false,
      rawValue: variable.rawValue,
    };
  }

  // Variable not found
  return {
    value: null,
    isResolved: false,
    isLoading: false,
    rawValue: undefined,
  };
}

/**
 * useVariableContext - Get full variable context.
 */
export function useVariableContext(): VariableContextValue {
  return useContext(VariableContext);
}

/**
 * Props for VariableProvider.
 */
export interface VariableProviderProps {
  /** Proposal ID to fetch variables for */
  proposalId?: string;
  /** Pre-loaded variables (if already fetched) */
  initialVariables?: Map<string, ResolvedVariable> | Record<string, ResolvedVariable>;
  /** API endpoint for fetching variables */
  apiEndpoint?: string;
  /** Children */
  children: ReactNode;
}

/**
 * VariableProvider - Provides resolved variables to descendants.
 *
 * @example
 * ```tsx
 * <VariableProvider proposalId="abc123">
 *   <ProposalEditor />
 * </VariableProvider>
 * ```
 */
export function VariableProvider({
  proposalId,
  initialVariables,
  apiEndpoint,
  children,
}: VariableProviderProps) {
  // Convert initial variables to Map if needed
  const initialMap = useMemo(() => {
    if (!initialVariables) return new Map<string, ResolvedVariable>();
    if (initialVariables instanceof Map) return initialVariables;

    // Convert object to Map
    const map = new Map<string, ResolvedVariable>();
    for (const [key, value] of Object.entries(initialVariables)) {
      map.set(key, value);
    }
    return map;
  }, [initialVariables]);

  const [variables, setVariables] = useState<Map<string, ResolvedVariable>>(initialMap);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch variables from API
  const refetch = useCallback(async () => {
    if (!proposalId && !apiEndpoint) return;

    setIsLoading(true);
    setError(null);

    try {
      const endpoint = apiEndpoint || `/api/proposals/${proposalId}/resolve`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch variables: ${response.statusText}`);
      }

      const data = await response.json();

      // Convert response to Map
      const newVariables = new Map<string, ResolvedVariable>();

      if (Array.isArray(data.variables)) {
        for (const variable of data.variables) {
          newVariables.set(variable.key, {
            key: variable.key,
            value: variable.value,
            isResolved: variable.isResolved ?? variable.value !== null,
            rawValue: variable.rawValue ?? variable.value,
            formatType: variable.formatType,
          });
        }
      } else if (typeof data.variables === "object") {
        for (const [key, variable] of Object.entries(data.variables)) {
          const v = variable as ResolvedVariable;
          newVariables.set(key, {
            key,
            value: v.value,
            isResolved: v.isResolved ?? v.value !== null,
            rawValue: v.rawValue ?? v.value,
            formatType: v.formatType,
          });
        }
      }

      setVariables(newVariables);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch variables";
      setError(errorMessage);

      if (process.env.NODE_ENV === "development") {
        console.error("[VariableProvider] Error fetching variables:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [proposalId, apiEndpoint]);

  // Set a single variable
  const setVariable = useCallback((key: string, value: ResolvedVariable) => {
    setVariables((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  }, []);

  // Context value
  const contextValue = useMemo(
    (): VariableContextValue => ({
      variables,
      isLoading,
      error,
      refetch,
      setVariable,
    }),
    [variables, isLoading, error, refetch, setVariable]
  );

  return (
    <VariableContext.Provider value={contextValue}>
      {children}
    </VariableContext.Provider>
  );
}

/**
 * Create a variable map from an array of variables.
 */
export function createVariableMap(
  variables: Array<{ key: string; value: string | null; rawValue?: unknown; formatType?: string }>
): Map<string, ResolvedVariable> {
  const map = new Map<string, ResolvedVariable>();

  for (const v of variables) {
    map.set(v.key, {
      key: v.key,
      value: v.value,
      isResolved: v.value !== null,
      rawValue: v.rawValue ?? v.value,
      formatType: v.formatType,
    });
  }

  return map;
}

export default useVariableValue;
