import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeamPanel, type MemberRow } from "@/components/dashboard/TeamPanel";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.organizationId) {
    redirect("/login");
  }

  const rows = await prisma.organizationMembership.findMany({
    where: {
      organizationId: session.user.organizationId,
      user: { deletedAt: null },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          discordId: true,
        },
      },
    },
  });

  const initialMembers: MemberRow[] = rows.map((m) => ({
    id: m.id,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
    user: m.user,
  }));

  return (
    <TeamPanel
      canManage={session.user.orgRole === "OWNER"}
      initialMembers={initialMembers}
    />
  );
}
