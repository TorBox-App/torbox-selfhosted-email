/// <reference types="@testing-library/jest-dom" />

import type matchers from "@testing-library/jest-dom/matchers";

declare module "@vitest/expect" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T>
    extends matchers.TestingLibraryMatchers<void, T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining
    extends matchers.TestingLibraryMatchers<void, unknown> {}
}
