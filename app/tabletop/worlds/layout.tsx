import AuthGuard from "@/app/components/AuthGuard";

export default function WorldsLayout({ children }: { children: React.ReactNode }) {
    return <AuthGuard>{children}</AuthGuard>;
}
