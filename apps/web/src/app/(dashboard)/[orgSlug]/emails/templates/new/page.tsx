import { TemplateGallery } from "@/components/template-editor/template-gallery";

type PageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function NewTemplatePage({ params }: PageProps) {
  const { orgSlug } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
      <h1 className="mb-6 font-semibold text-2xl">Create Template</h1>
      <TemplateGallery orgSlug={orgSlug} />
    </div>
  );
}
