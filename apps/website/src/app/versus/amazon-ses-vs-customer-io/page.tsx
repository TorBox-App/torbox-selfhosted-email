import { VersusArticle, versusMetadata } from "@/components/versus-article";
import { versusPageBySlug } from "@/config/versus";

const page = versusPageBySlug("amazon-ses-vs-customer-io");

export const metadata = versusMetadata(page);

export default function Page() {
  return <VersusArticle page={page} />;
}
