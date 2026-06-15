import AuthGuard from "@/app/components/AuthGuard";

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
    return <AuthGuard>{children}</AuthGuard>;
}
