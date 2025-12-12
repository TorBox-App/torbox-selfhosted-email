"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

const authModes = ["signin", "signup"] as const;

export default function AuthPage() {
  const [mode, setMode] = useQueryState(
    "mode",
    parseAsStringLiteral(authModes).withDefault("signin")
  );

  return (
    <>
      {mode === "signin" ? (
        <SignInForm onSwitchToSignUp={() => setMode("signup")} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setMode("signin")} />
      )}
    </>
  );
}
