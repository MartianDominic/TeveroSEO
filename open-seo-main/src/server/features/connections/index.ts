/**
 * Site Connections Feature
 *
 * Barrel export for platform detection, credential encryption,
 * connection management services, and platform adapters.
 */

// Services
export {
  detectPlatform,
  DETECTION_PROBES,
} from "./services/PlatformDetector";

export {
  encryptCredential,
  decryptCredential,
  validateEncryptionKey,
} from "./services/CredentialEncryption";

export {
  ConnectionService,
  connectionService,
} from "./services/ConnectionService";

// Adapters
export {
  WordPressAdapter,
  ShopifyAdapter,
} from "./adapters";

// Types
export type {
  PlatformType,
  ConnectionStatus,
  DetectionResult,
  DetectionSignal,
} from "./types";

export type {
  PlatformAdapter,
  CapabilityResult,
  WordPressAdapterConfig,
  ShopifyAdapterConfig,
} from "./adapters";

export type {
  CreateConnectionInput,
  ConnectionWithoutCredentials,
} from "./services/ConnectionService";

export { PLATFORM_TYPES, CONNECTION_STATUS } from "./types";
