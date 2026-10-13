import { redirect } from "next/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  const { screen } = await searchParams;
  redirect(screen ? `/dashboard?screen=${encodeURIComponent(screen)}` : "/dashboard");
}
