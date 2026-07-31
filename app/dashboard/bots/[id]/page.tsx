import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/access";
import { getPlan, type PlanId } from "@/lib/plans";
import { BotEditor } from "@/components/dashboard/BotEditor";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CustomCommand = {
  name: string;
  response: string;
};

function parseCommands(value: unknown): CustomCommand[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CustomCommand => {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    return typeof record.name === "string" && typeof record.response === "string";
  });
}

export default async function BotDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const bot = await prisma.bot.findFirst({
    where: { id, userId: session!.user.id },
  });

  if (!bot) notFound();

  const subscription = await getUserSubscription(session!.user.id);
  const plan = getPlan(subscription.plan as PlanId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-mist-400">
          Statut · {bot.status}
        </p>
        <h1 className="mt-1 font-display text-3xl text-mist-100">{bot.name}</h1>
        {plan.forceBranding ? (
          <p className="mt-2 text-sm text-warn">
            Plan Free : le branding Botly reste affiché sur ce bot.
          </p>
        ) : null}
      </div>

      <BotEditor
        botId={bot.id}
        initialName={bot.name}
        initialDescription={bot.description}
        initialModules={bot.enabledModules}
        initialCommands={parseCommands(bot.customCommands)}
        plan={plan}
        hasToken={bot.hasToken}
        inviteUrl={bot.inviteUrl}
        status={bot.status}
        lastError={bot.lastError}
      />
    </div>
  );
}
