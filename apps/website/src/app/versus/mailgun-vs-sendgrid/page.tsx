import { VersusArticle, versusMetadata } from "@/components/versus-article";
import { versusPageBySlug } from "@/config/versus";

const page = versusPageBySlug("mailgun-vs-sendgrid");

export const metadata = versusMetadata(page);

export default function Page() {
  return <VersusArticle page={page} />;
}
