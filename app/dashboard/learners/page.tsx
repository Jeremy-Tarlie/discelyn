import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listLearnersForOrg } from "@/lib/dashboard-data";
import { LearnersPanel } from "@/components/dashboard/LearnersPanel";

type PageProps = {
  searchParams: Promise<{ status?: string; billing?: string; q?: string }>;
};

export default async function LearnersPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const organizationId = session.user.organizationId;
  if (!organizationId) redirect("/login");

  const params = await searchParams;
  const status = params.status?.trim() ?? "";
  const billing = params.billing?.trim() ?? "";
  const q = params.q?.trim() ?? "";

  const learners = await listLearnersForOrg(organizationId, {
    status: status || null,
    billing: billing || null,
    q: q || null,
  });

  return (
    <LearnersPanel
      initialLearners={learners}
      status={status}
      billing={billing}
      q={q}
    />
  );
}
