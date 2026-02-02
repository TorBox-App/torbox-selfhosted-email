/** OpenTUI sends Enter as "enter" or "return" depending on terminal. */
export function isEnter(keyName: string): boolean {
  return keyName === "enter" || keyName === "return";
}

/** Returns tab direction or null if key is not tab. */
export function isTab(key: {
  name: string;
  shift?: boolean;
}): { forward: boolean } | null {
  if (key.name !== "tab") {
    return null;
  }
  return { forward: !key.shift };
}
