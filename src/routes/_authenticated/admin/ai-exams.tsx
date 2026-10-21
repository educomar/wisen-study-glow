import { createFileRoute } from "@tanstack/react-router";

import { ExamSetsManager } from "@/components/admin/ExamSetsManager";
import { PageHead } from "@/components/admin/team-context";

export const Route = createFileRoute("/_authenticated/admin/ai-exams")({
  head: () => ({ meta: [
    { title: "AI Exams — Wisen Team" },
    { name: "description", content: "Review, edit and approve Wisen AI generated exams shared with all students." },
    { property: "og:title", content: "AI Exams — Wisen Team" },
    { property: "og:description", content: "Review and publish Wisen AI generated exams." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <>
      <PageHead title="AI-Generated Exams" sub="Wisen AI drafts each exam once. Review, edit and verify every question, then publish it to all students." />
      <ExamSetsManager kind="ai_generated" />
    </>
  ),
});
