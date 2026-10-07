import { BookOpen, FileText, Layers, ListChecks } from "lucide-react";

import { openPage, useDoc } from "./doc";
import { setTab, useAppState } from "./store";
import { WisenChat } from "./WisenChat";
import { Button } from "@/components/ui/button";

export function WisenAI({ context }: { context?: string | undefined }) {
  const { doc, page } = useDoc();
  const s = useAppState();

  return (
    <div className="mx-auto grid h-full max-w-6xl gap-4 lg:grid-cols-[1fr_17rem]">
      <WisenChat context={context} />
      <aside className="space-y-3 text-sm">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Active document</p>
          <p className="mt-2 flex items-start gap-2 font-medium"><FileText className="mt-0.5 size-4 shrink-0 text-primary" />{doc.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{doc.subject} · {doc.pages.length} pages · reading page {page}</p>
          <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => openPage(page)}><BookOpen /> Open course file</Button>
        </div>
        {context && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Your context</p>
            <p className="mt-2">{context}</p>
            <p className="mt-1 text-xs text-muted-foreground">Faculty of Medicine · Sétif 1 knowledge base</p>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Continue the loop</p>
          <div className="mt-3 grid gap-2">
            <Button size="sm" variant="outline" onClick={() => setTab("cards")}><Layers /> Generate Kapsules</Button>
            <Button size="sm" variant="outline" onClick={() => setTab("qbank")}><ListChecks /> Practice in QBank</Button>
          </div>

        </div>
      </aside>
    </div>
  );
}
