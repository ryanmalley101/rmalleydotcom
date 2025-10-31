// app/AuthenticatorWrapper.tsx 

"use client"

import { Authenticator } from "@aws-amplify/ui-react";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json"; // Adjust path as needed

// ⚠️ CRITICAL: Run configuration synchronously at the module level.
// This ensures Amplify is configured before the Authenticator component renders.
// The typeof window check is a safe guard, though usually unnecessary for a "use client" component.
if (typeof window !== 'undefined' && !window.amplifyConfigured) {
    try {
        Amplify.configure(outputs);
        // 🚀 This line is now valid TypeScript due to the global declaration.
        window.amplifyConfigured = true; 
        console.log("Amplify configured client-side successfully.");
    } catch (error) {
        console.error("Amplify client configuration failed:", error);
    }
}

// NOTE: Remove all previous Amplify.configure calls from layout.tsx and any useEffect hooks.

export default function AuthenticatorWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    // The Authenticator is now guaranteed to have the configuration ready.
    return <Authenticator>{children}</Authenticator>;
}