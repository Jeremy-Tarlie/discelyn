import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listOutboundWebhooksForOrg } from "@/lib/dashboard-data";
import { WebhooksPanel } from "@/components/dashboard/WebhooksPanel";

export default async function OutboundWebhooksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const organizationId = session.user.organizationId;
  if (!organizationId) redirect("/login");

  const hooks = await listOutboundWebhooksForOrg(organizationId);
  return <WebhooksPanel initialHooks={hooks} />;
}
