import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "BNTicketing",
  description: "Scalper-proof soccer tickets",
};

async function Nav() {
  const user = await getCurrentUser();
  return (
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-5xl items-center gap-5 p-4 text-sm">
        <Link href="/" className="text-lg font-bold text-emerald-700">
          BNTicketing
        </Link>
        <Link href="/">Matches</Link>
        {user && <Link href="/wallet">My tickets</Link>}
        {user?.role === "ADMIN" && (
          <>
            <Link href="/admin">Admin</Link>
            <Link href="/admin/fraud">Fraud</Link>
            <Link href="/gate">Gate scanner</Link>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <UserButton />
          ) : (
            <>
              <SignInButton mode="modal" />
              <SignUpButton mode="modal" />
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
          <Nav />
          <main className="mx-auto max-w-5xl p-4">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}