import type { Metadata } from "next";
import { Hanken_Grotesk, Inter } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Providers } from "@/components/shared/Providers";
import { SwKillerAndBuildChip } from "@/components/shared/SwKillerAndBuildChip";

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", weight: ["400", "500", "600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "WorkProof — Work verified before payment",
  description: "Autonomous freelance escrow on Arbitrum. AI-verified deliverables. No manual approvals, no fake state.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg"
  },
  openGraph: {
    title: "WorkProof — Work verified before payment",
    description: "Autonomous freelance escrow on Arbitrum with GenLayer AI verification.",
    type: "website"
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const wagmiCookie = cookieStore.get("wagmi.store")?.value ?? null;

  return (
    <html lang="en">
      <body className={`${hanken.variable} ${inter.variable}`}>
        <Providers wagmiCookie={wagmiCookie}>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <MobileBottomNav />
          <SwKillerAndBuildChip />
        </Providers>
      </body>
    </html>
  );
}
