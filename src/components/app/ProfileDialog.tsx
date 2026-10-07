import type { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ProfileFields, type Fields } from "@/components/auth/ProfileFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { saveProfile, type Profile } from "@/lib/profile";
import { flushStudentData } from "./store";

export function ProfileDialog({ open, onOpenChange, user, profile, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; user: User; profile: Profile; onSaved: (p: Profile) => void }) {
  const [v, setV] = useState<Fields>(profile);
  const [name, setName] = useState(profile.full_name);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setV(profile); setName(profile.full_name); } }, [open, profile]);

  const save = async () => {
    setBusy(true);
    try {
      const p = await saveProfile(user, { full_name: name.trim(), faculty: v.faculty, department: v.department, academic_year: v.academic_year, current_target_exam: v.current_target_exam, onboarded: true });
      onSaved(p); onOpenChange(false); toast.success("Profile updated");
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  const signOut = async () => { try { await flushStudentData(); await supabase.auth.signOut(); window.location.replace("/login"); } catch (e) { toast.error(e instanceof Error ? e.message : "Please try again."); } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Your profile</DialogTitle><DialogDescription>{user.email}</DialogDescription></DialogHeader>
        <label className="block"><span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" /></label>
        <ProfileFields v={v} onChange={setV} />
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={signOut}><LogOut /> Sign out</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
