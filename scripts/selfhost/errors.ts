/**
 * Error reporting for the selfhost scripts.
 *
 * The implementation lives in packages/db/src/connection-url.ts so the CLI
 * reports migration failures identically — two copies of this drifted once
 * already, and the operator-facing half is the half that matters.
 */
export { describeMigrationError as describeError } from "../../packages/db/src/connection-url.js";
