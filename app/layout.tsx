// app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css";

import AuthenticatorWrapper from "./AuthenticatorWrapper";
// NOTE: You can remove the duplicate style import if it's already in amplifyConfig.ts
import "@aws-amplify/ui-react/styles.css"; 

import ThemeRegistry from "./components/themeRegistry/themeRegistry"

const inter = Inter({ subsets: ["latin"] });

// ... (Metadata remains the same)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body> 
        <AuthenticatorWrapper>
          <ThemeRegistry>
            {children}
          </ThemeRegistry>
        </AuthenticatorWrapper>
      </body>
    </html>
  );
}