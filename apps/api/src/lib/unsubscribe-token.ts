import {
  type UnsubscribeTokenPayload,
  verifyUnsubscribeToken as verifyCore,
} from "@wraps/unsubscribe-token";
import { log } from "./logger";

export {
  generatePreferencesUrl,
  generateUnsubscribeToken,
  generateUnsubscribeUrl,
  type UnsubscribeTokenPayload,
} from "@wraps/unsubscribe-token";

export function verifyUnsubscribeToken(
  token: string
): Promise<UnsubscribeTokenPayload | null> {
  return verifyCore(token, {
    info: (msg) => log.info(msg),
    warn: (msg) => log.warn(msg),
    error: (msg, err) => log.error(msg, err),
  });
}
