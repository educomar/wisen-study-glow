import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { setAiLevel } from "@/lib/ai/client";

export type Department = "Medicine" | "Dentistry";
export type Exam = "EMD1" | "EMD2";
export type Profile = {
  id: string;
  full_name: string;
  faculty: string;
  department: Department;
  academic_year: number;
  current_target_exam: Exam;
  onboarded: boolean;
};

export const FACULTIES = ["Faculty of Medicine — Sétif 1"];
export const YEARS: Record<Department, number> = { Medicine: 7, Dentistry: 6 };
export const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} Year`;
export const levelBadge = (p: Pick<Profile, "department" | "academic_year">) => `${p.department} · ${ordinal(p.academic_year)}`;
export const badge = (p: Pick<Profile, "department" | "academic_year" | "current_target_exam">) =>
  `${p.department} · ${ordinal(p.academic_year)} · ${p.current_target_exam}`;

export async function fetchProfile(uid: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function saveProfile(user: User, patch: Partial<Profile>) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, full_name: (user.user_metadata?.["full_name"] as string) ?? "", ...patch })
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (u: User | null) => {
    setUser(u);
    setProfile(u ? await fetchProfile(u.id) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        setTimeout(() => load(session?.user ?? null), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  useEffect(() => { setAiLevel(profile ? { department: profile.department, year: profile.academic_year } : undefined); }, [profile]);

  return { user, profile, setProfile, loading };
}

export const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/app");
