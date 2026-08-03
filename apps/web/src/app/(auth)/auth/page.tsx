import { auth } from "@wraps/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AuthForms from "./auth-forms";
import { resolveRedirect, type SearchParams } from "./resolve-redirect";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, session] = await Promise.all([
    searchParams,
    auth.api.getSession({ headers: await headers() }),
  ]);

  if (session?.user) {
    redirect(resolveRedirect(params));
  }

  return <AuthForms />;
}
