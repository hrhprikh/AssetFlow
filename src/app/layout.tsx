import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssetFlow — Enterprise Asset Management",
  description: "Centralized, role-based Enterprise Asset & Resource Management System for tracking physical assets from registration to disposal.",
  keywords: "asset management, ERP, resource booking, maintenance tracking, audit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
