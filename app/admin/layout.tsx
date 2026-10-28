import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  if (await userNeedsMfaChallenge(session.user.id)) {
    redirect("/login/mfa");
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { discordId: true, email: true },
  });
  if (!dbUser) {
    redirect("/login");
  }

  if (
    !isPlatformAdmin({
      email: session.user.email ?? dbUser.email,
      discordId: dbUser.discordId,
    })
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-page text-page-fg md:flex">
      <AdminNav />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 px-6 py-8 outline-none md:px-10"
      >
        {children}
      </main>
    </div>
  );
}
