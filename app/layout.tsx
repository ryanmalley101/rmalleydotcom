// app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css";

import AuthenticatorWrapper from "./AuthenticatorWrapper";
// NOTE: You can remove the duplicate style import if it's already in amplifyConfig.ts
// import "@aws-amplify/ui-react/styles.css"; 

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
        {/* The configuration is now guaranteed to run before AuthenticatorWrapper */}
        {/* 🛑 DEBUG MARKER START */}
        <div id="root-layout-marker" style={{ border: '2px solid red', padding: '5px' }}>
          GLOBAL LAYOUT IS ACTIVE
        </div>
        {/* 🛑 DEBUG MARKER END */}
        <AuthenticatorWrapper>
          <ThemeRegistry>
            {children}
          </ThemeRegistry>
        </AuthenticatorWrapper>
      </body>
    </html>
  );
}