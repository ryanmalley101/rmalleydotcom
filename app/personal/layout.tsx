"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import AuthGuard from "@/app/components/AuthGuard";

Amplify.configure(outputs, { ssr: true });

export default function PersonalLayout({ children }: { children: React.ReactNode }) {
    return <AuthGuard>{children}</AuthGuard>;
}
