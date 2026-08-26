import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "CampFlow — Turn Trek Enquiries Into Confirmed Bookings",
  description: "CampFlow helps trekking operators manage leads, follow-ups, bookings and payments from one simple dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
