import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserSubscription } from "@/lib/access";
import { getPlan, type PlanId } from "@/lib/plans";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const subscription = await getUserSubscription(session.user.id);
  const plan = getPlan(subscription.plan as PlanId);

  return (
    <div className="min-h-screen md:flex">
      <DashboardNav planName={plan.name} />
      <div className="flex-1 px-6 py-8 md:px-10">{children}</div>
    </div>
  );
}
