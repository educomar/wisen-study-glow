import { translate, useLang } from '@/lib/i18n';
import { BookOpen, Loader2, NotebookPen, Paperclip, RotateCcw, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { fileText } from "./ai-store";
import { AiSettings } from "./AiSettings";
import { Inline } from "./RichText";
import { ask, clearChat, useChat } from "./chat";
import { openPage, useDoc } from "./doc";
import type { AiMsg } from "./grounded";
import { addNote } from "./store";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

function McqView({ q }: { q: NonNullable<AiMsg["mcq"]> }) {
  useLang();
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
      <p className="font-medium">{q.stem}</p>
      {q.options ? (
        <div className="mt-2 grid gap-1.5">
          {q.options.map((o, k) => {
            const state =
              pick &&
              (o === q.answer
                ? "border-primary bg-primary/10 text-primary"
                : o === pick
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "opacity-60");
            return (
              <Button
                variant="outline"
                key={o}
                disabled={!!pick}
                onClick={() => setPick(o)}
                className={`rounded-md border border-border px-3 py-1.5 text-left text-xs ${state || "hover:border-primary"}`}
              >
                {String.fromCharCode(65 + k)}. {o}
              </Button>
            );
          })}
        </div>
      ) : (
        !pick && (
          <Button
            variant="outline"
            onClick={() => setPick("x")}
            className="mt-2 rounded-md border border-border px-3 py-1 text-xs hover:border-primary"
          >
             {translate("Reveal answer")} </Button>
        )
      )}
      {pick && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {q.options ? translate("Answer: ") + (q.answer) + translate(". ") : translate("")}
          </span>
          {q.options ? q.explain : q.answer} {!q.options && q.explain}
        </p>
      )}
    </div>
  );
}

const CHIPS = [
  "Summarize this page",
  "What's high-yield for EMD?",
  "Generate an EMD question",
  "EMD & coefficients at UFAS1",
];
const STUDIO_CHIPS = ["High-yield EMD questions", "Key differences table", "Quick mnemonic"];

export function WisenChat({
  context,
  initialQuery,
  onCitation,
  studio = false,
}: {
  studio?: boolean;
  context?: string | undefined;
  initialQuery?: string | undefined;
  onCitation?: (page: number) => void;
}) {
  useLang();
  const { msgs, typing } = useChat();
  const { doc, page } = useDoc();
  const [input, setInput] = useState("");
  useEffect(() => {
    if (initialQuery) setInput(initialQuery);
  }, [initialQuery]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!typing && !document.querySelector('[role="dialog"]'))
      inputRef.current?.focus({ preventScroll: true });
  }, [typing]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs.length, typing]);

  const pageText = (doc.pages.find((p) => p.pageNumber === page)?.text ?? "").slice(0, 1500);
  const chip = (c: string) => {
    if (studio)
      return ask("Ask", `${translate(c)}: use the current lecture and page ${page}. ${pageText}`, translate(c), page);
    if (c.startsWith("EMD &"))
      return ask("Ask", "EMD dates, QCM correction and module coefficients at UFAS1 1ère année", c);
    const action = c.startsWith("Summarize")
      ? "Summarize"
      : c.startsWith("Generate")
        ? "Generate EMD Question"
        : "Why on EMD?";
    return ask(action, `${c} (Page ${page}): ${pageText}`, `${c} (Page ${page})`);
  };
  const [att, setAtt] = useState<{ name: string; text?: string; image?: string } | null>(null);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const onAttach = async (f?: File) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      toast.error(translate("Please attach a file under 25 MB."));
      return;
    }
    setReading(true);
    try {
      if (f.type.startsWith("image/")) {
        const image = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = rej;
          r.readAsDataURL(f);
        });
        setAtt({ name: f.name, image });
      } else if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
        const text = await fileText(f);
        if (!text.trim()) toast.error(translate("No readable text found in this PDF."));
        else setAtt({ name: f.name, text });
      } else if (f.type.startsWith("text/") || /\.(txt|md)$/i.test(f.name))
        setAtt({ name: f.name, text: (await f.text()).slice(0, 38000) });
      else toast.error(translate("Attach a PDF, image or text file."));
    } catch {
      toast.error(translate("Couldn't read this file."));
    }
    setReading(false);
  };
  const send = () => {
    const t = input.trim() || (att ? "Analyse this file and explain its key points." : "");
    if (!t || typing || reading) return;
    setInput("");
    inputRef.current?.focus({ preventScroll: true });
    const a = att;
    setAtt(null);
    void ask(
      "Ask",
      t,
      a ? `📎 ${a.name}\n${t}` : t,
      undefined,
      a
        ? {
            ...(a.image ? { image: a.image } : {}),
            ...(a.text ? { attachment: { name: a.name, text: a.text } } : {}),
          }
        : undefined,
    );
  };

  return (
    <section
      className={
        studio
          ? "studio-chat"
          : "flex h-full min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-card"
      }
    >
      <header className="studio-chat-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
        <Logo className="studio-copilot-logo" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{translate("Wisen AI")}</p>
          <p className="truncate text-xs text-muted-foreground">
             {translate("Grounded in")} {translate(doc.title)}
            {context ? translate(" · ") + (context) : translate("")}
          </p>
        </div>
        <AiSettings />
        <Button
          variant="ghost"
          size="icon"
          disabled={typing}
          onClick={() => {
            clearChat();
            toast(translate("New conversation started"));
            inputRef.current?.focus();
          }}
          title={translate("New conversation")}
          aria-label={translate("New conversation")}
        >
          <RotateCcw className="size-4" />
        </Button>
        <span className="studio-context">
           {translate("Page")} {page} · {doc.subject}
        </span>
      </header>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="studio-transcript">
          {msgs.map((m, k) =>
            m.role === "user" ? (
              <Message key={k} from="user" dir="auto">
                <MessageContent className="studio-user-message">{m.text}</MessageContent>
              </Message>
            ) : (
              <Message key={k} from="assistant">
                <MessageContent>
                  <MessageResponse>{m.text}</MessageResponse>
                  {m.points && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/90">
                      {m.points.map((p) => (
                        <li key={p}>
                          <Inline text={p} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.mcq && <McqView q={m.mcq} />}
                  {m.sources?.map((s) => (
                    <p
                      key={s}
                      className="mr-1 mt-1 inline-flex rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[11px] text-primary"
                    >
                       {translate("Source:")} {translate(s)}
                    </p>
                  ))}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {m.cite ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (m.cite) (onCitation ?? openPage)(m.cite);
                        }}
                        className="h-auto px-2 py-0.5 font-mono text-[11px] text-primary"
                      >
                         {translate("[Source:")} {doc.subject}  {translate("· Page")} {m.cite}]
                      </Button>
                    ) : null}
                    {k > 0 && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          addNote(
                            [m.text, ...(m.points ?? [])].join("\n"),
                            doc.subject,
                            `Wisen AI · ${doc.title}`,
                            m.cite,
                          );
                          toast(translate("Saved to high-yield notes"));
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <NotebookPen className="size-3" />  {translate("Save note")} </Button>
                    )}
                  </div>
                </MessageContent>
              </Message>
            ),
          )}
          {typing && <Shimmer>{translate("Thinking through your lecture…")}</Shimmer>}
          <div ref={endRef} />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="studio-composer">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(studio ? STUDIO_CHIPS : CHIPS).map((c) => (
            <Button
              key={c}
              variant="outline"
              size="sm"
              disabled={typing}
              onClick={() => void chip(c)}
              className="studio-prompt-chip"
            >
              {translate(c)}
            </Button>
          ))}
        </div>
        {att && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs">
            <Paperclip className="size-3.5 text-primary" />
            <span className="flex-1 truncate">{att.name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAtt(null)}
              aria-label={translate("Remove attachment")}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf,image/*,.txt,.md"
          className="hidden"
          onChange={(e) => void onAttach(e.target.files?.[0])}
        />
        <PromptInput onSubmit={() => send()}>
          <PromptInputTextarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            dir="auto"
            placeholder={
              studio ? translate("Ask about this lecture…") : translate("Ask in English, Français, العربية or Darija…")
            }
            aria-label={translate("Ask Wisen AI")}
          />
          <PromptInputFooter>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={translate("Attach a file")}
              title={translate("Attach a file")}
              disabled={reading || typing}
              onClick={() => fileRef.current?.click()}
            >
              {reading ? <Loader2 className="animate-spin" /> : <Paperclip />}
            </Button>
            <span className="text-xs text-muted-foreground">
              {reading ? translate("Reading file…") : translate("Lecture context · Page ") + (page)}
            </span>
            <PromptInputSubmit
              aria-label={translate("Send")}
              status={typing ? "submitted" : "ready"}
              disabled={typing || reading || (!input.trim() && !att)}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}
