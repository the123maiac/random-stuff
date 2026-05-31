import type { ProviderType } from '@/lib/providers/types'

// Hand-written to mirror supabase/migrations. Regenerate with
// `supabase gen types typescript` once the CLI is wired up.

export interface Database {
  public: {
    Tables: {
      provider_connections: {
        Row: {
          id: string
          user_id: string
          provider_type: ProviderType
          label: string
          encrypted_key: string
          key_version: number
          base_url: string | null
          created_at: string
          updated_at: string
          last_used_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          provider_type: ProviderType
          label: string
          encrypted_key: string
          key_version: number
          base_url?: string | null
          created_at?: string
          updated_at?: string
          last_used_at?: string | null
        }
        Update: {
          label?: string
          encrypted_key?: string
          key_version?: number
          base_url?: string | null
          last_used_at?: string | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          id: number
          user_id: string
          connection_id: string | null
          provider_type: ProviderType
          model: string
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          created_at: string
        }
        Insert: {
          user_id: string
          connection_id?: string | null
          provider_type: ProviderType
          model: string
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          created_at?: string
        }
        Update: {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: { user_id: string; window_start: string; count: number }
        Insert: { user_id: string; window_start: string; count?: number }
        Update: { count?: number }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          user_id: string
          title: string
          connection_id: string | null
          model: string | null
          current_html: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          connection_id?: string | null
          model?: string | null
          current_html?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          connection_id?: string | null
          model?: string | null
          current_html?: string | null
        }
        Relationships: []
      }
      project_messages: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          content?: string
        }
        Relationships: []
      }
      published_sites: {
        Row: {
          id: string
          project_id: string
          user_id: string
          slug: string
          html: string
          published_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          slug: string
          html: string
          published_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          html?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_domains: {
        Row: {
          id: string
          site_id: string
          user_id: string
          hostname: string
          verification_token: string
          verified_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          site_id: string
          user_id: string
          hostname: string
          verification_token: string
          verified_at?: string | null
          created_at?: string
        }
        Update: {
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      bump_rate_limit: {
        Args: { p_user_id: string; p_window_seconds: number; p_limit: number }
        Returns: boolean
      }
      prune_rate_limit_counters: {
        Args: Record<never, never>
        Returns: undefined
      }
    }
    Enums: Record<never, never>
  }
}

// Convenience aliases used across the app.
export type ProviderConnectionRow = Database['public']['Tables']['provider_connections']['Row']
export type UsageEventRow = Database['public']['Tables']['usage_events']['Row']
