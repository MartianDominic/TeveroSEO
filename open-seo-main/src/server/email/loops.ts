import { getRequiredEnvValue } from "@/server/lib/runtime-env";
import { createLogger } from "@/server/lib/logger";
import { loopsClient, HttpError } from "@/server/lib/http-client";

const log = createLogger({ module: "loops" });

async function getHostedAuthEmailConfig() {
  return {
    apiKey: await getRequiredEnvValue("LOOPS_API_KEY"),
    verificationTemplateId: await getRequiredEnvValue(
      "LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID",
    ),
    passwordResetTemplateId: await getRequiredEnvValue(
      "LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID",
    ),
  };
}

async function sendLoopsTransactionalEmail({
  apiKey,
  email,
  transactionalId,
  dataVariables,
}: {
  apiKey: string;
  email: string;
  transactionalId: string;
  dataVariables: Record<string, string>;
}) {
  try {
    await loopsClient.post(
      "/transactional",
      {
        transactionalId,
        email,
        addToAudience: false,
        dataVariables,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 15000, // 15 second timeout for email
      },
    );
  } catch (error) {
    if (error instanceof HttpError) {
      log.error("Transactional email error", undefined, {
        status: error.status,
        email,
        transactionalId,
        errorBody: error.body.slice(0, 200),
      });
      throw new Error(
        `Failed to send Loops transactional email (${error.status})`,
      );
    }
    throw error;
  }
}

export async function sendHostedVerificationEmail({
  email,
  confirmationUrl,
}: {
  email: string;
  confirmationUrl: string;
}) {
  const config = await getHostedAuthEmailConfig();
  await sendLoopsTransactionalEmail({
    apiKey: config.apiKey,
    email,
    transactionalId: config.verificationTemplateId,
    dataVariables: {
      appName: "OpenSEO",
      confirmationUrl,
    },
  });
}

export async function sendHostedPasswordResetEmail({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}) {
  const config = await getHostedAuthEmailConfig();
  await sendLoopsTransactionalEmail({
    apiKey: config.apiKey,
    email,
    transactionalId: config.passwordResetTemplateId,
    dataVariables: {
      appName: "OpenSEO",
      resetUrl,
    },
  });
}
