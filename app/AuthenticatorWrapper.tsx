// AuthenticatorWrapper.tsx

"use client"

import { Authenticator } from "@aws-amplify/ui-react";
import { Amplify } from "aws-amplify"; // <-- Import Amplify here
import outputs from "@/amplify_outputs.json"; // <-- Import outputs here
import React, { useEffect } from 'react'; // <-- Import useEffect
import "@aws-amplify/ui-react/styles.css"; 

// Optional: You can remove the styles import from layout/config now
// import "@aws-amplify/ui-react/styles.css"; 

// A variable to track if configuration has run client-side
let isAmplifyConfigured = false;

export default function AuthenticatorWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    useEffect(() => {
        // Only run configuration once in the browser
        // if (!isAmplifyConfigured) {
        if (true) {
            try {
                // Configure Amplify with the client-side outputs
                Amplify.configure(outputs);
                isAmplifyConfigured = true;
                console.log("Amplify configured client-side successfully.");
            } catch (error) {
                console.error("Amplify configuration failed:", error);
            }
        }
    }, []);

    // The Authenticator component will wait for the client-side configuration 
    // to be complete before attempting to use the Auth category.
    return <Authenticator>{children}</Authenticator>;
}