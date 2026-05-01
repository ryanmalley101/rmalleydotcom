import AuthenticatorWrapper from "@/app/AuthenticatorWrapper";

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatorWrapper>{children}</AuthenticatorWrapper>;
}
