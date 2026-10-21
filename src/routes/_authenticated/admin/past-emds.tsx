import { createFileRoute } from "@tanstack/react-router";

import { ExamSetsManager } from "@/components/admin/ExamSetsManager";
import { PageHead } from "@/components/admin/team-context";

export const Route = createFileRoute("/_authenticated/admin/past-emds")({
  head: () => ({ meta: [
    { title: "Past EMDs — Wisen Team" },
    { name: "description", content: "Manage official past EMD papers: module, year, session, corrigé and review status." },
    { property: "og:title", content: "Past EMDs — Wisen Team" },
    { property: "og:description", content: "Manage, verify and publish official past EMD papers." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <>
      <PageHead title="Past EMDs" sub="Official previous-year exam papers. Transcribe once, verify the answer key, then publish to every student." />
      <ExamSetsManager kind="past_emd" />
    </>
  ),
});
