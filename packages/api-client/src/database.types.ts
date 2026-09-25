export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      analytics_consent: {
        Row: {
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          byte_size: number | null
          content_type: string | null
          created_at: string
          id: string
          job_id: string | null
          original_filename: string | null
          session_id: string | null
          storage_bucket: string
          storage_object_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          byte_size?: number | null
          content_type?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          original_filename?: string | null
          session_id?: string | null
          storage_bucket?: string
          storage_object_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          byte_size?: number | null
          content_type?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          original_filename?: string | null
          session_id?: string | null
          storage_bucket?: string
          storage_object_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_job_owner_fkey"
            columns: ["job_id", "user_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "attachments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_session_owner_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string | null
          id: string
          last_service_address: string | null
          normalized_email: string | null
          normalized_name: string
          normalized_phone: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          last_service_address?: string | null
          normalized_email?: string | null
          normalized_name?: string
          normalized_phone?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          last_service_address?: string | null
          normalized_email?: string | null
          normalized_name?: string
          normalized_phone?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_activity_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          job_id: string
          payload: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          job_id: string
          payload?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string
          payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_activity_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_activity_events_job_owner_fkey"
            columns: ["job_id", "user_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      job_costs: {
        Row: {
          cost_type: string
          cost_type_explicit: boolean
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          incurred_on: string | null
          job_id: string | null
          quantity: number | null
          quantity_explicit: boolean
          session_id: string | null
          total_cost_cents: number
          unit: string | null
          unit_cost_cents: number | null
          unit_cost_explicit: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_type?: string
          cost_type_explicit?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          incurred_on?: string | null
          job_id?: string | null
          quantity?: number | null
          quantity_explicit?: boolean
          session_id?: string | null
          total_cost_cents: number
          unit?: string | null
          unit_cost_cents?: number | null
          unit_cost_explicit?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_type?: string
          cost_type_explicit?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          incurred_on?: string | null
          job_id?: string | null
          quantity?: number | null
          quantity_explicit?: boolean
          session_id?: string | null
          total_cost_cents?: number
          unit?: string | null
          unit_cost_cents?: number | null
          unit_cost_explicit?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_costs_job_owner_fkey"
            columns: ["job_id", "user_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "job_costs_session_owner_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "material_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_export_requests: {
        Row: {
          byte_size: number | null
          created_at: string
          delivery_attempts: number
          delivery_state: string
          expires_at: string | null
          failure_code: string | null
          first_send_at: string | null
          generated_at: string | null
          generation_attempts: number
          generation_state: string
          id: string
          next_retry_at: string | null
          object_path: string | null
          recipient_email: string
          reporting_time_zone: string
          reporting_year: number
          resend_message_id: string | null
          scrubbed_at: string | null
          sent_at: string | null
          token_hash: string | null
          user_id: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          delivery_attempts?: number
          delivery_state?: string
          expires_at?: string | null
          failure_code?: string | null
          first_send_at?: string | null
          generated_at?: string | null
          generation_attempts?: number
          generation_state?: string
          id?: string
          next_retry_at?: string | null
          object_path?: string | null
          recipient_email: string
          reporting_time_zone: string
          reporting_year: number
          resend_message_id?: string | null
          scrubbed_at?: string | null
          sent_at?: string | null
          token_hash?: string | null
          user_id: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          delivery_attempts?: number
          delivery_state?: string
          expires_at?: string | null
          failure_code?: string | null
          first_send_at?: string | null
          generated_at?: string | null
          generation_attempts?: number
          generation_state?: string
          id?: string
          next_retry_at?: string | null
          object_path?: string | null
          recipient_email?: string
          reporting_time_zone?: string
          reporting_year?: number
          resend_message_id?: string | null
          scrubbed_at?: string | null
          sent_at?: string | null
          token_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          collected_cents: number
          completed_at: string | null
          costs_reviewed_at: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["job_created_via_enum"]
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          deleted_at: string | null
          id: string
          is_job_record_complete: boolean
          job_payment_state: string | null
          job_type: string | null
          job_work_status: Database["public"]["Enums"]["job_work_status_enum"]
          last_worked_at: string | null
          list_recency_at: string | null
          long_description: string | null
          materials_reviewed_at: string | null
          no_revenue_confirmed_at: string | null
          other_costs_reviewed_at: string | null
          paid_at: string | null
          revenue_cents: number | null
          service_address: string | null
          short_description: string
          updated_at: string
          user_id: string
        }
        Insert: {
          collected_cents?: number
          completed_at?: string | null
          costs_reviewed_at?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["job_created_via_enum"]
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          id?: string
          is_job_record_complete?: boolean
          job_payment_state?: string | null
          job_type?: string | null
          job_work_status?: Database["public"]["Enums"]["job_work_status_enum"]
          last_worked_at?: string | null
          list_recency_at?: string | null
          long_description?: string | null
          materials_reviewed_at?: string | null
          no_revenue_confirmed_at?: string | null
          other_costs_reviewed_at?: string | null
          paid_at?: string | null
          revenue_cents?: number | null
          service_address?: string | null
          short_description: string
          updated_at?: string
          user_id: string
        }
        Update: {
          collected_cents?: number
          completed_at?: string | null
          costs_reviewed_at?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["job_created_via_enum"]
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          id?: string
          is_job_record_complete?: boolean
          job_payment_state?: string | null
          job_type?: string | null
          job_work_status?: Database["public"]["Enums"]["job_work_status_enum"]
          last_worked_at?: string | null
          list_recency_at?: string | null
          long_description?: string | null
          materials_reviewed_at?: string | null
          no_revenue_confirmed_at?: string | null
          other_costs_reviewed_at?: string | null
          paid_at?: string | null
          revenue_cents?: number | null
          service_address?: string | null
          short_description?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_owner_fkey"
            columns: ["customer_id", "user_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          app_version: string | null
          document_type: string
          document_version: string
          id: string
          platform: string | null
          source: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          app_version?: string | null
          document_type: string
          document_version: string
          id?: string
          platform?: string | null
          source: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          app_version?: string | null
          document_type?: string
          document_version?: string
          id?: string
          platform?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          job_id: string | null
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_id?: string | null
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_id?: string | null
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_job_owner_fkey"
            columns: ["job_id", "user_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_session_owner_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          trades: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          trades?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          trades?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          calendar_date_explicit: boolean
          clock_end_explicit: boolean
          clock_start_explicit: boolean
          clock_times_explicit: boolean
          created_at: string
          deleted_at: string | null
          ended_at: string | null
          entry_mode: Database["public"]["Enums"]["session_entry_mode_enum"]
          id: string
          job_id: string
          session_status: Database["public"]["Enums"]["session_status_enum"]
          started_at: string
          started_tz: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_date_explicit?: boolean
          clock_end_explicit?: boolean
          clock_start_explicit?: boolean
          clock_times_explicit?: boolean
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          entry_mode: Database["public"]["Enums"]["session_entry_mode_enum"]
          id?: string
          job_id: string
          session_status: Database["public"]["Enums"]["session_status_enum"]
          started_at: string
          started_tz?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_date_explicit?: boolean
          clock_end_explicit?: boolean
          clock_start_explicit?: boolean
          clock_times_explicit?: boolean
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          entry_mode?: Database["public"]["Enums"]["session_entry_mode_enum"]
          id?: string
          job_id?: string
          session_status?: Database["public"]["Enums"]["session_status_enum"]
          started_at?: string
          started_tz?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_job_owner_fkey"
            columns: ["job_id", "user_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      waitlist_rate_limits: {
        Row: {
          attempts: number
          key_hash: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          key_hash: string
          window_started_at: string
        }
        Update: {
          attempts?: number
          key_hash?: string
          window_started_at?: string
        }
        Relationships: []
      }
      waitlist_signups: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          job_sources: string[]
          marketing_consent: boolean | null
          privacy_accepted_at: string | null
          privacy_policy_version: string | null
          status: string
          terms_accepted_at: string | null
          terms_version: string | null
          tracking_tools: string[]
          trades: string[]
          uses_software: boolean
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          job_sources?: string[]
          marketing_consent?: boolean | null
          privacy_accepted_at?: string | null
          privacy_policy_version?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          tracking_tools?: string[]
          trades?: string[]
          uses_software: boolean
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          job_sources?: string[]
          marketing_consent?: boolean | null
          privacy_accepted_at?: string | null
          privacy_policy_version?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          tracking_tools?: string[]
          trades?: string[]
          uses_software?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_job_export_request: {
        Args: { p_time_zone: string; p_year: number }
        Returns: Json
      }
      ack_job_export_queue_message: {
        Args: { p_message_id: number }
        Returns: boolean
      }
      apply_job_detail_edit: {
        Args: { p_job_id: string; p_payload: Json }
        Returns: Json
      }
      apply_job_detail_edit_atomic: {
        Args: { p_job_id: string; p_payload: Json }
        Returns: Json
      }
      claim_job_export_queue_messages: {
        Args: { p_quantity?: number }
        Returns: {
          message_id: number
          read_count: number
          request_id: string
        }[]
      }
      consume_waitlist_rate_limit: {
        Args: { p_key_hash: string; p_limit?: number }
        Returns: boolean
      }
      end_stale_live_sessions: { Args: never; Returns: number }
      job_export_rows: {
        Args: {
          p_before_completed_at?: string
          p_before_created_at?: string
          p_before_id?: string
          p_limit?: number
          p_request_id: string
        }
        Returns: {
          completed_at: string
          created_at: string
          customer_name: string
          disposal_cost: number
          equipment_rental_cost: number
          helper_labor_cost: number
          job_description: string
          job_id: string
          last_worked_at: string
          long_description: string
          material_cost: number
          other_cost: number
          paid_at: string
          payment_status: string
          permit_cost: number
          revenue_cents: number
          service_address: string
          travel_parking_cost: number
          work_status: string
        }[]
      }
      list_customer_suggestions: { Args: { p_query?: string }; Returns: Json }
      retry_job_export_queue_message: {
        Args: { p_delay_seconds: number; p_message_id: number }
        Returns: undefined
      }
      save_job_customer: {
        Args: { p_job_id: string; p_payload: Json }
        Returns: Json
      }
    }
    Enums: {
      job_created_via_enum: "session_start" | "add_job"
      job_work_status_enum:
        | "not_started"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "canceled"
      session_entry_mode_enum: "live" | "manual"
      session_status_enum: "in_progress" | "ended" | "deleted"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      job_created_via_enum: ["session_start", "add_job"],
      job_work_status_enum: [
        "not_started",
        "in_progress",
        "on_hold",
        "completed",
        "canceled",
      ],
      session_entry_mode_enum: ["live", "manual"],
      session_status_enum: ["in_progress", "ended", "deleted"],
    },
  },
} as const

