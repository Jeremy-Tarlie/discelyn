import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { shouldShowEnvironmentBanner, getAppEnvironment } from "@/lib/demo";
import { getRequestTheme } from "@/lib/theme";
import { Providers } from "@/components/Providers";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: {
      default: t("defaultTitle"),
      template: "%s · Botly",
    },
    description: t("defaultDescription"),
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    ),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const theme = await getRequestTheme();
  const showBanner = shouldShowEnvironmentBanner();
  const appEnv = getAppEnvironment();
  const tCommon = await getTranslations("common");

  return (
    <html
      lang={locale}
      className={`${outfit.variable} ${syne.variable}${theme === "dark" ? " dark" : ""}`}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <body>
        {showBanner ? (
          <div
            role="status"
            className="border-b border-warn/40 bg-warn/15 px-4 py-2 text-center text-sm text-[#1a1c21] dark:text-mist-100"
          >
            {tCommon("envBanner", { env: appEnv })}
          </div>
        ) : null}
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
