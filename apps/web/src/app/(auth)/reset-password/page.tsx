import { Suspense } from "react";
import Loader from "@/components/loader";
import { ResetPasswordForm } from "./components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
