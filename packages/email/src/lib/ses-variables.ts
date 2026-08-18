/**
 * SES Variable Transformation Utilities
 *
 * The implementations live in `@wraps/template-render/mustache-case` — that
 * module is dependency-free regex code, so the dashboard can import it in the
 * browser and transform authoring syntax exactly the way the send paths do.
 * Re-exported here so existing `@wraps/email` importers are unaffected.
 */

export {
  flattenVariablesForSes,
  toSesVariableName,
  transformVariablesForSes,
} from "@wraps/template-render/mustache-case";
