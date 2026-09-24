import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listLearnersForUser } from "@/lib/dashboard-data";
import { LearnersPanel } from "@/components/dashboard/LearnersPanel";

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

export default async function LearnersPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const status = params.status?.trim() ?? "";
  const q = params.q?.trim() ?? "";

  const learners = await listLearnersForUser(session.user.id, {
    status: status || null,
    q: q || null,
  });

  return (
    <LearnersPanel initialLearners={learners} status={status} q={q} />
  );
}
