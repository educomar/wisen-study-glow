export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_flashcards: {
        Row: {
          back: string
          created_at: string
          front: string
          id: string
          scope_label: string
          subject: string
          tip: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          front: string
          id?: string
          scope_label?: string
          subject?: string
          tip?: string
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          front?: string
          id?: string
          scope_label?: string
          subject?: string
          tip?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_questions: {
        Row: {
          answers: Json
          created_at: string
          difficulty: string
          explanation: string
          id: string
          lesson: string
          options: Json
          origin: string
          qtype: string
          source: string
          stem: string
          subject: string
          unit: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          difficulty?: string
          explanation?: string
          id?: string
          lesson?: string
          options?: Json
          origin?: string
          qtype?: string
          source?: string
          stem: string
          subject?: string
          unit?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          difficulty?: string
          explanation?: string
          id?: string
          lesson?: string
          options?: Json
          origin?: string
          qtype?: string
          source?: string
          stem?: string
          subject?: string
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          actor_role: string
          created_at: string
          detail: Json
          entity_id: string | null
          entity_label: string
          entity_type: string
          id: string
          result: string
        }
        Insert: {
          action: string
          actor_email?: string
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_label?: string
          entity_type?: string
          id?: string
          result?: string
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_label?: string
          entity_type?: string
          id?: string
          result?: string
        }
        Relationships: []
      }
      kb_entries: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          source_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          source_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          source_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_resources: {
        Row: {
          created_at: string
          drive_created_at: string | null
          file_name: string
          id: string
          kind: string
          lesson_id: string | null
          mime_type: string
          size_bytes: number
          storage_path: string
          subject_id: string
          unit_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          drive_created_at?: string | null
          file_name: string
          id?: string
          kind?: string
          lesson_id?: string | null
          mime_type?: string
          size_bytes?: number
          storage_path: string
          subject_id: string
          unit_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          drive_created_at?: string | null
          file_name?: string
          id?: string
          kind?: string
          lesson_id?: string | null
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          subject_id?: string
          unit_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_year: number
          created_at: string
          current_target_exam: string
          department: string
          faculty: string
          full_name: string
          id: string
          language: string
          onboarded: boolean
          updated_at: string
        }
        Insert: {
          academic_year?: number
          created_at?: string
          current_target_exam?: string
          department?: string
          faculty?: string
          full_name?: string
          id: string
          language?: string
          onboarded?: boolean
          updated_at?: string
        }
        Update: {
          academic_year?: number
          created_at?: string
          current_target_exam?: string
          department?: string
          faculty?: string
          full_name?: string
          id?: string
          language?: string
          onboarded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      qbank_questions: {
        Row: {
          answer: number
          answers: Json
          created_at: string
          created_by: string | null
          difficulty: string
          explanation: string
          id: string
          lesson_id: string
          options: Json
          stem: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          answer?: number
          answers?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string
          id?: string
          lesson_id: string
          options?: Json
          stem: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          answer?: number
          answers?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string
          id?: string
          lesson_id?: string
          options?: Json
          stem?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "qbank_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      question_versions: {
        Row: {
          changed_by: string | null
          changed_by_email: string
          created_at: string
          id: string
          note: string
          question_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string
          created_at?: string
          id?: string
          note?: string
          question_id: string
          snapshot: Json
          version: number
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string
          created_at?: string
          id?: string
          note?: string
          question_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: []
      }
      student_data: {
        Row: {
          activity: Json
          attempts: Json
          bookmarks: Json
          card_states: Json
          created_at: string
          custom_cards: Json
          custom_questions: Json
          exam_history: Json
          notes: Json
          question_results: Json
          review_history: Json
          saved_cards: Json
          study_sessions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          activity?: Json
          attempts?: Json
          bookmarks?: Json
          card_states?: Json
          created_at?: string
          custom_cards?: Json
          custom_questions?: Json
          exam_history?: Json
          notes?: Json
          question_results?: Json
          review_history?: Json
          saved_cards?: Json
          study_sessions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          activity?: Json
          attempts?: Json
          bookmarks?: Json
          card_states?: Json
          created_at?: string
          custom_cards?: Json
          custom_questions?: Json
          exam_history?: Json
          notes?: Json
          question_results?: Json
          review_history?: Json
          saved_cards?: Json
          study_sessions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_tasks: {
        Row: {
          completed: boolean
          created_at: string
          duration: number
          id: string
          kind: string
          slot: string
          start_time: string
          task_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          duration?: number
          id?: string
          kind?: string
          slot?: string
          start_time?: string
          task_date: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          duration?: number
          id?: string
          kind?: string
          slot?: string
          start_time?: string
          task_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          academic_year: number
          created_at: string
          created_by: string | null
          department: string
          faculty: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          academic_year?: number
          created_at?: string
          created_by?: string | null
          department?: string
          faculty?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          academic_year?: number
          created_at?: string
          created_by?: string | null
          department?: string
          faculty?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      team_flashcards: {
        Row: {
          back: string
          created_at: string
          created_by: string | null
          front: string
          id: string
          lesson_id: string
          updated_at: string
        }
        Insert: {
          back: string
          created_at?: string
          created_by?: string | null
          front: string
          id?: string
          lesson_id: string
          updated_at?: string
        }
        Update: {
          back?: string
          created_at?: string
          created_by?: string | null
          front?: string
          id?: string
          lesson_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_flashcards_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token_hash?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position?: number
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_admin: { Args: { _user_id: string }; Returns: boolean }
      is_active_team: { Args: { _user_id: string }; Returns: boolean }
      student_can_see_subject: {
        Args: { _subject_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor"],
    },
  },
} as const
