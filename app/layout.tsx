// app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css";
import "@aws-amplify/ui-react/styles.css";
import ThemeRegistry from "./components/themeRegistry/themeRegistry";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ryan Malley",
  description: "Projects in software, hardware, and tabletop.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}