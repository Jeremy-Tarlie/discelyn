import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listAffiliatesForUser } from "@/lib/dashboard-data";
import { AffiliatesPanel } from "@/components/dashboard/AffiliatesPanel";

export default async function AffiliatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const rows = await listAffiliatesForUser(session.user.id);
  return <AffiliatesPanel initialRows={rows} />;
}
