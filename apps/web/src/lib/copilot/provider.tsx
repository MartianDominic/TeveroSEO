/**
 * CopilotKit Provider
 * Phase 82: Chat Integration
 *
 * Wraps application with CopilotKit context.
 * Registers keyword analysis tools.
 */

"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";

import "@copilotkit/react-ui/styles.css";
import { ReactNode } from "react";

interface CopilotProviderProps {
  children: ReactNode;
  runtimeUrl?: string;
}

/**
 * CopilotKit provider with default configuration.
 *
 * Note: For production, configure runtimeUrl to point to your
 * CopilotKit runtime endpoint. For development, uses the default.
 */
export function CopilotProvider({
  children,
  runtimeUrl = "/api/copilot"
}: CopilotProviderProps) {
  return (
    <CopilotKit runtimeUrl={runtimeUrl}>
      {children}
      {/* Global popup available throughout app */}
      <CopilotPopup
        instructions="You are a keyword analysis assistant. Help users analyze keywords for SEO by extracting constraints from their client conversations and selecting the most relevant keywords."
        labels={{
          title: "Keyword Analysis Assistant",
          initial: "How can I help you analyze keywords today?",
        }}
      />
    </CopilotKit>
  );
}

export default CopilotProvider;
