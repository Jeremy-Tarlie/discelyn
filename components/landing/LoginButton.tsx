"use client";

import { signIn } from "next-auth/react";

export function LoginButton() {
  return (
    <button
      type="button"
      onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
      className="w-full rounded-full bg-[#5865F2] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
    >
      Continuer avec Discord
    </button>
  );
}
