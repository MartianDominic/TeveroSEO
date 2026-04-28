/**
 * Type definitions for Dokobit API client.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * Dokobit provides Smart-ID and Mobile-ID signing services
 * for legally binding eIDAS qualified electronic signatures.
 */

/**
 * Supported Baltic countries for Smart-ID/Mobile-ID.
 */
export type SigningCountry = "LT" | "EE" | "LV";

/**
 * Parameters for initiating Smart-ID signing.
 */
export interface SmartIdSigningParams {
  /** Lithuanian personal code (11 digits) */
  personalCode: string;
  /** Country code (LT, EE, LV) */
  country: SigningCountry;
  /** SHA256 hash of the document to sign */
  documentHash: string;
  /** Human-readable document name shown to user */
  documentName: string;
}

/**
 * Parameters for initiating Mobile-ID signing.
 */
export interface MobileIdSigningParams extends SmartIdSigningParams {
  /** Phone number with country code (e.g., +37060012345) */
  phoneNumber: string;
}

/**
 * Response from initiating a signing session.
 */
export interface SigningSession {
  /** Unique session ID for polling status */
  sessionId: string;
  /** 4-digit verification code to show the user */
  verificationCode: string;
}

/**
 * Signing session status values.
 */
export type SigningStatusValue = "pending" | "completed" | "failed" | "expired";

/**
 * Status of a signing session.
 */
export interface SigningStatus {
  /** Current status of the signing session */
  status: SigningStatusValue;
  /** URL to download signed document (only when completed) */
  signedDocumentUrl?: string;
  /** Error message (only when failed) */
  error?: string;
}

/**
 * Dokobit API client interface.
 */
export interface DokobitClient {
  /**
   * Initiate a Smart-ID signing session.
   * User will receive a push notification on their Smart-ID app.
   */
  initiateSmartIdSigning(params: SmartIdSigningParams): Promise<SigningSession>;

  /**
   * Initiate a Mobile-ID signing session.
   * User will receive an SMS with verification request.
   */
  initiateMobileIdSigning(params: MobileIdSigningParams): Promise<SigningSession>;

  /**
   * Get the current status of a signing session.
   * Poll this endpoint every 2 seconds until status is not "pending".
   */
  getSigningStatus(sessionId: string): Promise<SigningStatus>;

  /**
   * Download the signed document after signing is completed.
   * Returns the signed PDF as a Buffer.
   */
  downloadSignedDocument(sessionId: string): Promise<Buffer>;

  /**
   * Cancel a pending signing session.
   * Used for cleanup when DB operations fail after session creation.
   */
  cancelSession(sessionId: string): Promise<void>;
}
