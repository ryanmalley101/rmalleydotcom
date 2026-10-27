"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, Container } from "@mantine/core";
import { ArrowLeft } from "lucide-react";

// Every screen of a calculator: the dark page, and the link back to the
// Professional page. It reads "All professional tools", not "Back", so it
// can't be mistaken for the wizard's own Back button; `onLeave` can cancel
// it (e.preventDefault()) to protect an unfinished setup.
export default function CalculatorFrame({ size, onLeave, children }: {
  size: "lg" | "xl";
  onLeave?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <Box style={{ minHeight: "100vh", background: "#0f1117" }} py="xl">
      <Container size={size}>
        <Button component={Link} href="/professional" leftSection={<ArrowLeft size={16} />} variant="subtle" mb="lg" onClick={onLeave}>
          All professional tools
        </Button>
        {children}
      </Container>
    </Box>
  );
}

// Keeps the address bar in sync with the comparison, debounced, so copying
// it directly works as well as the Share button, and so a refresh mid-wizard
// returns to the same step (`?step=`; a link without it opens the results).
export function useAddressBarSync(phase: "intro" | "wizard" | "results", stepIndex: number, shareUrl: string) {
  const router = useRouter();
  useEffect(() => {
    if (phase === "intro" || !shareUrl) return;
    const t = setTimeout(() => {
      const url = new URL(shareUrl);
      if (phase === "wizard") url.searchParams.set("step", String(stepIndex));
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
  }, [phase, stepIndex, shareUrl, router]);
}

// "Leave the calculator?" for an unfinished setup.
export function confirmLeaveSetup(e: React.MouseEvent) {
  if (!window.confirm("Leave the calculator? Your unfinished setup won't be saved.")) e.preventDefault();
}
