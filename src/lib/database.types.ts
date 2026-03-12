/**
 * database.types.ts — Supabase TypeScript schema types.
 *
 * IMPORTANT: This file is a hand-maintained stub. Regenerate it after
 * applying any database migration by running:
 *
 *   npm run db:types
 *
 * This runs:
 *   supabase gen types typescript --local > src/lib/database.types.ts
 *
 * If the local Supabase CLI is unavailable, you can generate types against
 * the remote project:
 *   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 *
 * The Database type is used by the Supabase client (src/lib/supabase.ts)
 * to provide fully-typed query builder methods.
 */

// ── Type helpers ──────────────────────────────────────────────────────────────

type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ── Database ──────────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          plan: 'free' | 'trialing' | 'pro' | 'past_due' | 'canceled' | 'student' | 'enterprise'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_end: string | null
          is_developer: boolean
          is_admin: boolean
          is_moderator: boolean
          verified_author: boolean
          stripe_account_id: string | null
          stripe_onboarded: boolean
          accepted_terms_version: string | null
          accepted_terms_at: string | null
          marketing_opt_in: boolean
          marketing_opt_in_at: string | null
          is_student: boolean
          student_email: string | null
          student_verified_at: string | null
          student_expires_at: string | null
          onboarding_completed_at: string | null
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'trialing' | 'pro' | 'past_due' | 'canceled' | 'student' | 'enterprise'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          is_developer?: boolean
          is_admin?: boolean
          is_moderator?: boolean
          verified_author?: boolean
          stripe_account_id?: string | null
          stripe_onboarded?: boolean
          accepted_terms_version?: string | null
          accepted_terms_at?: string | null
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          is_student?: boolean
          student_email?: string | null
          student_verified_at?: string | null
          student_expires_at?: string | null
          onboarding_completed_at?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'trialing' | 'pro' | 'past_due' | 'canceled' | 'student' | 'enterprise'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          is_developer?: boolean
          is_admin?: boolean
          is_moderator?: boolean
          verified_author?: boolean
          stripe_account_id?: string | null
          stripe_onboarded?: boolean
          accepted_terms_version?: string | null
          accepted_terms_at?: string | null
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          is_student?: boolean
          student_email?: string | null
          student_verified_at?: string | null
          student_expires_at?: string | null
          onboarding_completed_at?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [{ foreignKeyName: 'profiles_id_fkey'; columns: ['id']; referencedRelation: 'users'; referencedColumns: ['id'] }]
      }

      projects: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          storage_key: string | null
          active_canvas_id: string | null
          variables: Json
          org_id: string | null
          folder: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          storage_key?: string | null
          active_canvas_id?: string | null
          variables?: Json
          org_id?: string | null
          folder?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          storage_key?: string | null
          active_canvas_id?: string | null
          variables?: Json
          org_id?: string | null
          folder?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'projects_owner_id_fkey'; columns: ['owner_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }

      canvases: {
        Row: {
          id: string
          project_id: string
          owner_id: string
          name: string
          position: number
          storage_path: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          owner_id: string
          name: string
          position: number
          storage_path: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          owner_id?: string
          name?: string
          position?: number
          storage_path?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'canvases_project_id_fkey'; columns: ['project_id']; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'canvases_owner_id_fkey'; columns: ['owner_id']; referencedRelation: 'users'; referencedColumns: ['id'] }
        ]
      }

      project_assets: {
        Row: {
          id: string
          project_id: string
          user_id: string
          name: string
          storage_path: string
          mime_type: string | null
          size: number | null
          kind: string | null
          sha256: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          name: string
          storage_path: string
          mime_type?: string | null
          size?: number | null
          kind?: string | null
          sha256?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          name?: string
          storage_path?: string
          mime_type?: string | null
          size?: number | null
          kind?: string | null
          sha256?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'project_assets_project_id_fkey'; columns: ['project_id']; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'project_assets_user_id_fkey'; columns: ['user_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }

      user_preferences: {
        Row: {
          id: string
          theme: string
          decimal_places: number
          scientific_notation_threshold: number
          thousands_separator: boolean
          precision_mode: string
          significant_figures: number
          angle_unit: string
          keybindings: Json
          decimal_separator: string
          canvas_snap_to_grid: boolean
          canvas_show_minimap: boolean
          canvas_show_grid: boolean
          autosave_enabled: boolean
          autosave_interval_seconds: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          theme?: string
          decimal_places?: number
          scientific_notation_threshold?: number
          thousands_separator?: boolean
          precision_mode?: string
          significant_figures?: number
          angle_unit?: string
          keybindings?: Json
          decimal_separator?: string
          canvas_snap_to_grid?: boolean
          canvas_show_minimap?: boolean
          canvas_show_grid?: boolean
          autosave_enabled?: boolean
          autosave_interval_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          theme?: string
          decimal_places?: number
          scientific_notation_threshold?: number
          thousands_separator?: boolean
          precision_mode?: string
          significant_figures?: number
          angle_unit?: string
          keybindings?: Json
          decimal_separator?: string
          canvas_snap_to_grid?: boolean
          canvas_show_minimap?: boolean
          canvas_show_grid?: boolean
          autosave_enabled?: boolean
          autosave_interval_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'user_preferences_id_fkey'; columns: ['id']; referencedRelation: 'users'; referencedColumns: ['id'] }
        ]
      }

      observability_events: {
        Row: {
          id: string
          ts: string
          env: string
          app_version: string | null
          event_type: string
          user_id: string | null
          session_id: string | null
          route_path: string | null
          fingerprint: string | null
          payload: Json
          tags: Json
          cf: Json
          created_at: string
        }
        Insert: {
          id?: string
          ts: string
          env: string
          app_version?: string | null
          event_type: string
          user_id?: string | null
          session_id?: string | null
          route_path?: string | null
          fingerprint?: string | null
          payload?: Json
          tags?: Json
          cf?: Json
          created_at?: string
        }
        Update: {
          id?: string
          ts?: string
          env?: string
          app_version?: string | null
          event_type?: string
          user_id?: string | null
          session_id?: string | null
          route_path?: string | null
          fingerprint?: string | null
          payload?: Json
          tags?: Json
          cf?: Json
          created_at?: string
        }
        Relationships: []
      }

      group_templates: {
        Row: {
          id: string
          owner_id: string
          name: string
          color: string
          payload: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          color?: string
          payload: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          color?: string
          payload?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'group_templates_owner_id_fkey'; columns: ['owner_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }

      share_links: {
        Row: {
          id: string
          project_id: string
          token: string
          created_by: string
          created_at: string
          expires_at: string | null
          view_count: number
          is_active: boolean
        }
        Insert: {
          id?: string
          project_id: string
          token?: string
          created_by: string
          created_at?: string
          expires_at?: string | null
          view_count?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          project_id?: string
          token?: string
          created_by?: string
          created_at?: string
          expires_at?: string | null
          view_count?: number
          is_active?: boolean
        }
        Relationships: [
          { foreignKeyName: 'share_links_project_id_fkey'; columns: ['project_id']; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'share_links_created_by_fkey'; columns: ['created_by']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }

      node_comments: {
        Row: {
          id: string
          project_id: string
          canvas_id: string
          node_id: string
          owner_id: string
          content: string
          is_resolved: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          canvas_id: string
          node_id: string
          owner_id: string
          content: string
          is_resolved?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          canvas_id?: string
          node_id?: string
          owner_id?: string
          content?: string
          is_resolved?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'node_comments_project_id_fkey'; columns: ['project_id']; referencedRelation: 'projects'; referencedColumns: ['id'] }
        ]
      }

      math_constants: {
        Row: {
          id: string
          name: string
          symbol: string | null
          value_f64: number | null
          value_string: string
          precision_digits: number | null
          uncertainty: string | null
          unit: string | null
          description: string | null
          category: string | null
          source: string
        }
        Insert: {
          id: string
          name: string
          symbol?: string | null
          value_f64?: number | null
          value_string: string
          precision_digits?: number | null
          uncertainty?: string | null
          unit?: string | null
          description?: string | null
          category?: string | null
          source?: string
        }
        Update: {
          id?: string
          name?: string
          symbol?: string | null
          value_f64?: number | null
          value_string?: string
          precision_digits?: number | null
          uncertainty?: string | null
          unit?: string | null
          description?: string | null
          category?: string | null
          source?: string
        }
        Relationships: []
      }

      simulation_runs: {
        Row: {
          id: string
          project_id: string
          canvas_id: string | null
          owner_id: string
          run_type: 'parametric' | 'optimization' | 'montecarlo' | 'sweep'
          config: Json
          results_storage_path: string | null
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at: string | null
          completed_at: string | null
          node_count: number | null
          eval_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          canvas_id?: string | null
          owner_id: string
          run_type: 'parametric' | 'optimization' | 'montecarlo' | 'sweep'
          config?: Json
          results_storage_path?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at?: string | null
          completed_at?: string | null
          node_count?: number | null
          eval_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          canvas_id?: string | null
          owner_id?: string
          run_type?: 'parametric' | 'optimization' | 'montecarlo' | 'sweep'
          config?: Json
          results_storage_path?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at?: string | null
          completed_at?: string | null
          node_count?: number | null
          eval_time_ms?: number | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'simulation_runs_project_id_fkey'; columns: ['project_id']; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'simulation_runs_owner_id_fkey'; columns: ['owner_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }

      project_snapshots: {
        Row: {
          id: string
          project_id: string
          canvas_id: string
          owner_id: string
          snapshot_storage_path: string
          label: string | null
          format_version: number | null
          node_count: number | null
          edge_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          canvas_id: string
          owner_id: string
          snapshot_storage_path: string
          label?: string | null
          format_version?: number | null
          node_count?: number | null
          edge_count?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          canvas_id?: string
          owner_id?: string
          snapshot_storage_path?: string
          label?: string | null
          format_version?: number | null
          node_count?: number | null
          edge_count?: number | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'project_snapshots_project_id_fkey'; columns: ['project_id']; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'project_snapshots_canvas_id_fkey'; columns: ['canvas_id']; referencedRelation: 'canvases'; referencedColumns: ['id'] }
        ]
      }

      bug_reports: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          metadata: Json
          screenshot_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string
          metadata?: Json
          screenshot_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          metadata?: Json
          screenshot_path?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'bug_reports_user_id_fkey'; columns: ['user_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }

      suggestions: {
        Row: {
          id: string
          user_id: string
          category: string
          title: string
          description: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category?: string
          title: string
          description?: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          title?: string
          description?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'suggestions_user_id_fkey'; columns: ['user_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }

      audit_log: {
        Row: {
          id: string
          user_id: string | null
          org_id: string | null
          event_type: string
          object_type: string
          object_id: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          org_id?: string | null
          event_type: string
          object_type: string
          object_id: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          org_id?: string | null
          event_type?: string
          object_type?: string
          object_id?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }

      marketplace_items: {
        Row: {
          id: string
          author_id: string
          name: string
          description: string | null
          category: string
          version: string
          thumbnail_url: string | null
          payload: Json | null
          downloads_count: number
          likes_count: number
          comments_count: number
          is_published: boolean
          review_status: 'pending' | 'approved' | 'rejected'
          price_cents: number
          tags: string[]
          org_id: string | null
          is_official: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          name: string
          description?: string | null
          category?: string
          version?: string
          thumbnail_url?: string | null
          payload?: Json | null
          downloads_count?: number
          likes_count?: number
          comments_count?: number
          is_published?: boolean
          review_status?: 'pending' | 'approved' | 'rejected'
          price_cents?: number
          tags?: string[]
          org_id?: string | null
          is_official?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          author_id?: string
          name?: string
          description?: string | null
          category?: string
          version?: string
          thumbnail_url?: string | null
          payload?: Json | null
          downloads_count?: number
          likes_count?: number
          comments_count?: number
          is_published?: boolean
          review_status?: 'pending' | 'approved' | 'rejected'
          price_cents?: number
          tags?: string[]
          org_id?: string | null
          is_official?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      delete_my_account: {
        Args: Record<string, never>
        Returns: { storage_paths: string[] }[]
      }
      save_project_metadata: {
        Args: {
          p_id: string
          p_known_updated_at: string
          p_name: string
          p_storage_key: string
          p_variables: Json
        }
        Returns: { updated_at: string; conflict: boolean }[]
      }
      check_display_name_available: {
        Args: { p_name: string }
        Returns: boolean
      }
      get_constant: {
        Args: { p_id: string }
        Returns: {
          id: string
          name: string
          symbol: string | null
          value_f64: number | null
          value_string: string
          precision_digits: number | null
          uncertainty: string | null
          unit: string | null
          description: string | null
          category: string | null
          source: string
        }[]
      }
      update_my_profile: {
        Args: {
          p_full_name?: string
          p_avatar_url?: string
          p_display_name?: string
          p_accepted_terms_version?: string
          p_marketing_opt_in?: boolean
        }
        Returns: {
          id: string
          full_name: string | null
          avatar_url: string | null
          display_name: string | null
          updated_at: string
        }[]
      }
      get_my_profile: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          plan: string
          is_admin: boolean
          is_developer: boolean
          verified_author: boolean
          display_name: string | null
          onboarding_completed_at: string | null
          created_at: string
        }[]
      }
    }

    Enums: {
      plan_status: 'free' | 'trialing' | 'pro' | 'past_due' | 'canceled' | 'student' | 'enterprise'
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ── Convenience type aliases ───────────────────────────────────────────────────

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
