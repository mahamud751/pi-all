import { notFound } from "next/navigation";
import { ConsolePage } from "@/app/console";
import { resolvePath, staticPaths } from "@/app/lib/routes";

export function generateStaticParams() {
  return staticPaths.map((path) => ({ slug: path.slice(1).split("/") }));
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const match = resolvePath(`/${slug.join("/")}`);
  if (!match) notFound();
  if (match === "auth") return null;
  return <ConsolePage view={match.view} id={match.id} />;
}
