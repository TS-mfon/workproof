import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Providers } from "@/components/shared/Providers";

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });

export const metadata: Metadata = {
  title: "WorkProof",
  description: "Onchain hiring escrow with proof-of-work attestation",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg"
  },
  openGraph: {
    title: "WorkProof",
    description: "Hire and get hired with autonomous GenLayer-verified escrow.",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={hanken.variable}>
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
