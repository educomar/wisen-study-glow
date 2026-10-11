import { BookOpen, Layers, NotebookPen, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { badge, useSession } from "@/lib/profile";
import { CourseReader, type PassageSelection } from "./CourseReader";
import { WisenChat } from "./WisenChat";
import { ask, useChat } from "./chat";
import { jumpToPage, useDoc } from "./doc";
import { addCard, addNote, flushStudentData, useAppState } from "./store";

export function ParallelWorkspace() {
  const { user, profile } = useSession();
  const { doc } = useDoc();
  const state = useAppState();
  const { typing } = useChat();
  const [tab, setTab] = useState<"ai" | "notes">("ai");
  const [card, setCard] = useState<PassageSelection | null>(null);
  const [front, setFront] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewAnswer, setPreviewAnswer] = useState(false);
  const notes = state.notes.filter((n) => n.source === doc.title);

  async function action(name: string, selection: PassageSelection) {
    if (name === "Make Kapsule") {
      if (!user) {
        toast.error("Sign in to save Kapsules.");
        return;
      }
      setCard(selection);
      setFront("");
      setPreviewAnswer(false);
      return;
    }
    if (name === "Save Note") {
      if (!user) {
        toast.error("Sign in to save your notes.");
        return;
      }
      addNote(selection.text, selection.subject, selection.title, selection.page);
      setTab("notes");
      try {
        await flushStudentData();
        toast.success("Passage saved to your notes.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Your note could not be saved.");
      }
      return;
    }
    if (typing) {
      toast("Wait for the current answer to finish.");
      return;
    }
    setTab("ai");
    const request = name === "EMD Trap" ? "Why on EMD?" : name === "Quiz Me" ? "Quiz me" : name;
    await ask(
      request,
      selection.text,
      `${name} · ${selection.subject} · Page ${selection.page}\n“${selection.text}”`,
      selection.page,
    );
  }

  async function saveCard() {
    if (!card || !front.trim() || saving || !user) return;
    setSaving(true);
    addCard(
      front.trim(),
      card.text,
      `Lecture passage · Page ${card.page}`,
      card.subject,
      card.title,
    );
    try {
      await flushStudentData();
      setCard(null);
      toast.success("Kapsule saved and ready to review.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Your Kapsule could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="parallel-workspace">
      <h1 className="sr-only">Parallel Study Workspace</h1>
      <div className="parallel-panes">
        <section aria-label="Lecture viewer" className="parallel-lecture">
          <CourseReader
            parallel
            onSelectionAction={(name, selection) => {
              void action(name, selection);
            }}
          />
        </section>
        <aside aria-label="Contextual study assistant" className="parallel-assistant">
          <div className="studio-copilot-tabs" role="tablist" aria-label="Workspace tools">
            <Button
              role="tab"
              aria-selected={tab === "ai"}
              variant={tab === "ai" ? "secondary" : "ghost"}
              onClick={() => setTab("ai")}
            >
              <BookOpen />
              Wisen AI
            </Button>
            <Button
              role="tab"
              aria-selected={tab === "notes"}
              variant={tab === "notes" ? "secondary" : "ghost"}
              onClick={() => setTab("notes")}
            >
              <NotebookPen />
              Lecture Notes <span>{notes.length}</span>
            </Button>
          </div>
          <div className={tab === "ai" ? "parallel-chat" : "hidden"}>
            <WisenChat
              studio
              context={profile ? badge(profile) : undefined}
              onCitation={jumpToPage}
            />
          </div>
          {tab === "notes" && (
            <section
              aria-label="Lecture notes"
              className="studio-notebook min-h-0 flex-1 overflow-auto"
            >
              {!notes.length && (
                <div className="studio-notebook-empty">
                  <NotebookPen />
                  <h2>Lecture Notebook</h2>
                  <p>No saved passages for this lecture yet.</p>
                </div>
              )}
              {notes.map((note) => (
                <article key={note.id} className="studio-note">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(note.t).toLocaleDateString()}
                    </span>
                    {note.page && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => jumpToPage(note.page ?? 1)}
                      >
                        Page {note.page}
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7">{note.text}</p>
                </article>
              ))}
            </section>
          )}
        </aside>
      </div>
      <Dialog
        open={!!card}
        onOpenChange={(open) => {
          if (!open && !saving) setCard(null);
        }}
      >
        <DialogContent className="study-theme reference-theme studio-kapsule-dialog">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="text-primary" />
            Make Kapsule
          </DialogTitle>
          <DialogDescription>
            From {card?.subject} · Page {card?.page}
          </DialogDescription>
          {card && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveCard();
              }}
            >
              <label className="block text-sm font-medium">
                Recall question
                <input
                  autoFocus
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  required
                  placeholder="What do you want to remember?"
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Answer
                <textarea
                  value={card.text}
                  onChange={(e) => setCard({ ...card, text: e.target.value })}
                  required
                  rows={4}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
                />
              </label>
              <div className="studio-kapsule-preview">
                <span>INSTANT PREVIEW · {previewAnswer ? "ANSWER" : "QUESTION"}</span>
                <p>{previewAnswer ? card.text : front.trim() || "Your recall question"}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewAnswer((v) => !v)}
                >
                  {previewAnswer ? "Show question" : "Reveal answer"}
                  <ArrowUpRight />
                </Button>
              </div>
              <Button
                className="w-full"
                type="submit"
                disabled={saving || !front.trim() || !card.text.trim()}
              >
                <Layers />
                {saving ? "Saving…" : "Save Kapsule"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
