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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          anonymised_at: string | null
          created_at: string
          deleted_at: string | null
          first_name: string | null
          kyc_status: Database["public"]["Enums"]["account_kyc_status"]
          kyc_verified_at: string | null
          last_name: string | null
          marketing_opt_in: boolean
          nationality: string | null
          preferred_language: Database["public"]["Enums"]["account_language"]
          residency_status:
            | Database["public"]["Enums"]["account_residency_status"]
            | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anonymised_at?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          kyc_status?: Database["public"]["Enums"]["account_kyc_status"]
          kyc_verified_at?: string | null
          last_name?: string | null
          marketing_opt_in?: boolean
          nationality?: string | null
          preferred_language?: Database["public"]["Enums"]["account_language"]
          residency_status?:
            | Database["public"]["Enums"]["account_residency_status"]
            | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anonymised_at?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          kyc_status?: Database["public"]["Enums"]["account_kyc_status"]
          kyc_verified_at?: string | null
          last_name?: string | null
          marketing_opt_in?: boolean
          nationality?: string | null
          preferred_language?: Database["public"]["Enums"]["account_language"]
          residency_status?:
            | Database["public"]["Enums"]["account_residency_status"]
            | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      amenities_taxonomy: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["amenity_category"]
          code: string
          created_at: string
          icon: string | null
          label: string
          label_ar: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["amenity_category"]
          code: string
          created_at?: string
          icon?: string | null
          label: string
          label_ar?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["amenity_category"]
          code?: string
          created_at?: string
          icon?: string | null
          label?: string
          label_ar?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          notes: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["api_key_role"]
          status: Database["public"]["Enums"]["api_key_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          notes?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["api_key_role"]
          status?: Database["public"]["Enums"]["api_key_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          notes?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["api_key_role"]
          status?: Database["public"]["Enums"]["api_key_status"]
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      area_guides: {
        Row: {
          amenities: Json
          area_id: string
          created_at: string
          hero_image_id: string | null
          intro_md: string | null
          intro_md_ar: string | null
          published_at: string | null
          related_areas: string[]
          schools: Json
          seo: Json | null
          stats: Json
          updated_at: string
        }
        Insert: {
          amenities?: Json
          area_id: string
          created_at?: string
          hero_image_id?: string | null
          intro_md?: string | null
          intro_md_ar?: string | null
          published_at?: string | null
          related_areas?: string[]
          schools?: Json
          seo?: Json | null
          stats?: Json
          updated_at?: string
        }
        Update: {
          amenities?: Json
          area_id?: string
          created_at?: string
          hero_image_id?: string | null
          intro_md?: string | null
          intro_md_ar?: string | null
          published_at?: string | null
          related_areas?: string[]
          schools?: Json
          seo?: Json | null
          stats?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_guides_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: true
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_guides_hero_image_id_fkey"
            columns: ["hero_image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          created_at: string
          description: string | null
          description_ar: string | null
          geo: Json | null
          hero_image_id: string | null
          id: string
          kind: Database["public"]["Enums"]["area_kind"]
          name: string
          name_ar: string | null
          parent_id: string | null
          seo_meta: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          geo?: Json | null
          hero_image_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["area_kind"]
          name: string
          name_ar?: string | null
          parent_id?: string | null
          seo_meta?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          geo?: Json | null
          hero_image_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["area_kind"]
          name?: string
          name_ar?: string | null
          parent_id?: string | null
          seo_meta?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_hero_image_id_fkey"
            columns: ["hero_image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      article_categories: {
        Row: {
          created_at: string
          description: string | null
          description_ar: string | null
          id: string
          is_active: boolean
          label: string
          label_ar: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_active?: boolean
          label: string
          label_ar?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_active?: boolean
          label?: string
          label_ar?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          author_id: string | null
          body_html: string
          body_html_ar: string | null
          category: string
          created_at: string
          deleted_at: string | null
          excerpt: string | null
          excerpt_ar: string | null
          hero_image_id: string | null
          id: string
          published_at: string | null
          read_minutes: number | null
          scheduled_for: string | null
          seo: Json | null
          slug: string
          status: Database["public"]["Enums"]["article_status"]
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_html?: string
          body_html_ar?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          excerpt_ar?: string | null
          hero_image_id?: string | null
          id?: string
          published_at?: string | null
          read_minutes?: number | null
          scheduled_for?: string | null
          seo?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["article_status"]
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_html?: string
          body_html_ar?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          excerpt_ar?: string | null
          hero_image_id?: string | null
          id?: string
          published_at?: string | null
          read_minutes?: number | null
          scheduled_for?: string | null
          seo?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["article_status"]
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "articles_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "article_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "articles_hero_image_id_fkey"
            columns: ["hero_image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: Database["public"]["Enums"]["audit_actor_kind"]
          after: Json | null
          at: string
          before: Json | null
          id: string
          ip: unknown
          target_id: string | null
          target_kind: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind?: Database["public"]["Enums"]["audit_actor_kind"]
          after?: Json | null
          at?: string
          before?: Json | null
          id?: string
          ip?: unknown
          target_id?: string | null
          target_kind?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: Database["public"]["Enums"]["audit_actor_kind"]
          after?: Json | null
          at?: string
          before?: Json | null
          id?: string
          ip?: unknown
          target_id?: string | null
          target_kind?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      backup_area_subpages_20260811: {
        Row: {
          blocks: Json | null
          created_at: string | null
          id: string | null
          published_at: string | null
          seo: Json | null
          slug: string | null
          status: Database["public"]["Enums"]["page_status"] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          blocks?: Json | null
          created_at?: string | null
          id?: string | null
          published_at?: string | null
          seo?: Json | null
          slug?: string | null
          status?: Database["public"]["Enums"]["page_status"] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          blocks?: Json | null
          created_at?: string | null
          id?: string | null
          published_at?: string | null
          seo?: Json | null
          slug?: string | null
          status?: Database["public"]["Enums"]["page_status"] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bulk_operations: {
        Row: {
          action: Database["public"]["Enums"]["bulk_action_kind"]
          actor_id: string | null
          created_at: string
          id: string
          payload: Json | null
          skipped: Json
          succeeded: Json
          target_count: number
          target_kind: string
        }
        Insert: {
          action: Database["public"]["Enums"]["bulk_action_kind"]
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          skipped?: Json
          succeeded?: Json
          target_count: number
          target_kind?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["bulk_action_kind"]
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          skipped?: Json
          succeeded?: Json
          target_count?: number
          target_kind?: string
        }
        Relationships: []
      }
      concierge_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          input_tokens: number | null
          output_tokens: number | null
          results: Json | null
          role: Database["public"]["Enums"]["concierge_message_role"]
          session_id: string
          tool_use: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          results?: Json | null
          role: Database["public"]["Enums"]["concierge_message_role"]
          session_id: string
          tool_use?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          results?: Json | null
          role?: Database["public"]["Enums"]["concierge_message_role"]
          session_id?: string
          tool_use?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "concierge_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "concierge_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_sessions: {
        Row: {
          anon_token: string | null
          brief: Json
          created_at: string
          handed_off_at: string | null
          handed_off_to: string | null
          id: string
          input_tokens: number
          output_tokens: number
          pinned_property_ids: string[]
          turn_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anon_token?: string | null
          brief?: Json
          created_at?: string
          handed_off_at?: string | null
          handed_off_to?: string | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          pinned_property_ids?: string[]
          turn_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anon_token?: string | null
          brief?: Json
          created_at?: string
          handed_off_at?: string | null
          handed_off_to?: string | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          pinned_property_ids?: string[]
          turn_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concierge_sessions_handed_off_to_fkey"
            columns: ["handed_off_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      content_assets: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          follow_up_after_days: number | null
          id: string
          kind: Database["public"]["Enums"]["content_asset_kind"]
          name: string
          next_asset_id: string | null
          notes: string | null
          position: number
          slug: string
          status: Database["public"]["Enums"]["content_asset_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          follow_up_after_days?: number | null
          id?: string
          kind: Database["public"]["Enums"]["content_asset_kind"]
          name: string
          next_asset_id?: string | null
          notes?: string | null
          position?: number
          slug: string
          status?: Database["public"]["Enums"]["content_asset_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          follow_up_after_days?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["content_asset_kind"]
          name?: string
          next_asset_id?: string | null
          notes?: string | null
          position?: number
          slug?: string
          status?: Database["public"]["Enums"]["content_asset_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "content_assets_next_asset_id_fkey"
            columns: ["next_asset_id"]
            isOneToOne: false
            referencedRelation: "content_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          enquiry_id: string
          id: string
        }
        Insert: {
          created_at?: string
          enquiry_id: string
          id?: string
        }
        Update: {
          created_at?: string
          enquiry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: true
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      cta_clicks: {
        Row: {
          advisor_id: string | null
          advisor_name: string | null
          context_ref: string | null
          created_at: string
          cta_id: string | null
          cta_key: string
          destination: string | null
          development_id: string | null
          id: string
          kind: string
          locale: string | null
          page_title: string | null
          path: string
          property_id: string | null
          source: string
        }
        Insert: {
          advisor_id?: string | null
          advisor_name?: string | null
          context_ref?: string | null
          created_at?: string
          cta_id?: string | null
          cta_key: string
          destination?: string | null
          development_id?: string | null
          id?: string
          kind: string
          locale?: string | null
          page_title?: string | null
          path: string
          property_id?: string | null
          source?: string
        }
        Update: {
          advisor_id?: string | null
          advisor_name?: string | null
          context_ref?: string | null
          created_at?: string
          cta_id?: string | null
          cta_key?: string
          destination?: string | null
          development_id?: string | null
          id?: string
          kind?: string
          locale?: string | null
          page_title?: string | null
          path?: string
          property_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "cta_clicks_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cta_clicks_cta_id_fkey"
            columns: ["cta_id"]
            isOneToOne: false
            referencedRelation: "floating_ctas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_clicks_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_clicks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_profiles: {
        Row: {
          awards: Json
          bio: string | null
          created_at: string
          current_focus: string | null
          developer_id: string
          founded: number | null
          headquarters: string | null
          hero_image_id: string | null
          published_at: string | null
          seo: Json | null
          signature_styles: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          awards?: Json
          bio?: string | null
          created_at?: string
          current_focus?: string | null
          developer_id: string
          founded?: number | null
          headquarters?: string | null
          hero_image_id?: string | null
          published_at?: string | null
          seo?: Json | null
          signature_styles?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          awards?: Json
          bio?: string | null
          created_at?: string
          current_focus?: string | null
          developer_id?: string
          founded?: number | null
          headquarters?: string | null
          hero_image_id?: string | null
          published_at?: string | null
          seo?: Json | null
          signature_styles?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_profiles_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: true
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_profiles_hero_image_id_fkey"
            columns: ["hero_image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      developers: {
        Row: {
          created_at: string
          description: string | null
          description_ar: string | null
          founded_year: number | null
          id: string
          logo_id: string | null
          name: string
          name_ar: string | null
          published_at: string | null
          slug: string
          stats: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          founded_year?: number | null
          id?: string
          logo_id?: string | null
          name: string
          name_ar?: string | null
          published_at?: string | null
          slug: string
          stats?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          founded_year?: number | null
          id?: string
          logo_id?: string | null
          name?: string
          name_ar?: string | null
          published_at?: string | null
          slug?: string
          stats?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developers_logo_id_fkey"
            columns: ["logo_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      development_media: {
        Row: {
          created_at: string
          development_id: string
          media_id: string
          role: Database["public"]["Enums"]["development_media_role"]
          sort_order: number
        }
        Insert: {
          created_at?: string
          development_id: string
          media_id: string
          role?: Database["public"]["Enums"]["development_media_role"]
          sort_order?: number
        }
        Update: {
          created_at?: string
          development_id?: string
          media_id?: string
          role?: Database["public"]["Enums"]["development_media_role"]
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "development_media_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      development_unit_types: {
        Row: {
          beds: number | null
          blurb: string | null
          blurb_ar: string | null
          created_at: string
          development_id: string
          enabled: boolean
          id: string
          label: string
          label_ar: string | null
          price_from_aed: number | null
          size_from_ft2: number | null
          size_to_ft2: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          beds?: number | null
          blurb?: string | null
          blurb_ar?: string | null
          created_at?: string
          development_id: string
          enabled?: boolean
          id?: string
          label: string
          label_ar?: string | null
          price_from_aed?: number | null
          size_from_ft2?: number | null
          size_to_ft2?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          beds?: number | null
          blurb?: string | null
          blurb_ar?: string | null
          created_at?: string
          development_id?: string
          enabled?: boolean
          id?: string
          label?: string
          label_ar?: string | null
          price_from_aed?: number | null
          size_from_ft2?: number | null
          size_to_ft2?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_unit_types_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
        ]
      }
      development_units: {
        Row: {
          beds: number | null
          built_up_ft2: number | null
          created_at: string
          development_id: string
          floor_plan_id: string | null
          id: string
          lagoon_access: string | null
          lagoon_access_ar: string | null
          orientation: string | null
          orientation_ar: string | null
          plot_ft2: number | null
          plot_number: string | null
          price_aed: number | null
          sort_order: number
          status: Database["public"]["Enums"]["development_unit_status"]
          unit_type: string
          unit_type_ar: string | null
          updated_at: string
        }
        Insert: {
          beds?: number | null
          built_up_ft2?: number | null
          created_at?: string
          development_id: string
          floor_plan_id?: string | null
          id?: string
          lagoon_access?: string | null
          lagoon_access_ar?: string | null
          orientation?: string | null
          orientation_ar?: string | null
          plot_ft2?: number | null
          plot_number?: string | null
          price_aed?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["development_unit_status"]
          unit_type: string
          unit_type_ar?: string | null
          updated_at?: string
        }
        Update: {
          beds?: number | null
          built_up_ft2?: number | null
          created_at?: string
          development_id?: string
          floor_plan_id?: string | null
          id?: string
          lagoon_access?: string | null
          lagoon_access_ar?: string | null
          orientation?: string | null
          orientation_ar?: string | null
          plot_ft2?: number | null
          plot_number?: string | null
          price_aed?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["development_unit_status"]
          unit_type?: string
          unit_type_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_units_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_units_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      developments: {
        Row: {
          amenities: string[]
          amenities_ar: string[] | null
          area_id: string | null
          bedrooms_text: string | null
          bedrooms_text_ar: string | null
          brochure_id: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          developer_id: string
          escrow_account: string | null
          facts: Json
          handover_date: string | null
          hero_image_id: string | null
          id: string
          lead_advisor_id: string | null
          master_plan: Json
          masterplan_id: string | null
          meta: Json | null
          name: string
          name_ar: string | null
          payment_plan: Json | null
          published_at: string | null
          seo: Json | null
          slug: string
          starting_price: number | null
          status: Database["public"]["Enums"]["development_status"]
          tagline: string | null
          tagline_ar: string | null
          total_units: number | null
          updated_at: string
          vision: string | null
          vision_ar: string | null
        }
        Insert: {
          amenities?: string[]
          amenities_ar?: string[] | null
          area_id?: string | null
          bedrooms_text?: string | null
          bedrooms_text_ar?: string | null
          brochure_id?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          developer_id: string
          escrow_account?: string | null
          facts?: Json
          handover_date?: string | null
          hero_image_id?: string | null
          id?: string
          lead_advisor_id?: string | null
          master_plan?: Json
          masterplan_id?: string | null
          meta?: Json | null
          name: string
          name_ar?: string | null
          payment_plan?: Json | null
          published_at?: string | null
          seo?: Json | null
          slug: string
          starting_price?: number | null
          status?: Database["public"]["Enums"]["development_status"]
          tagline?: string | null
          tagline_ar?: string | null
          total_units?: number | null
          updated_at?: string
          vision?: string | null
          vision_ar?: string | null
        }
        Update: {
          amenities?: string[]
          amenities_ar?: string[] | null
          area_id?: string | null
          bedrooms_text?: string | null
          bedrooms_text_ar?: string | null
          brochure_id?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          developer_id?: string
          escrow_account?: string | null
          facts?: Json
          handover_date?: string | null
          hero_image_id?: string | null
          id?: string
          lead_advisor_id?: string | null
          master_plan?: Json
          masterplan_id?: string | null
          meta?: Json | null
          name?: string
          name_ar?: string | null
          payment_plan?: Json | null
          published_at?: string | null
          seo?: Json | null
          slug?: string
          starting_price?: number | null
          status?: Database["public"]["Enums"]["development_status"]
          tagline?: string | null
          tagline_ar?: string | null
          total_units?: number | null
          updated_at?: string
          vision?: string | null
          vision_ar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developments_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developments_brochure_id_fkey"
            columns: ["brochure_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developments_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developments_hero_image_id_fkey"
            columns: ["hero_image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developments_lead_advisor_id_fkey"
            columns: ["lead_advisor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "developments_masterplan_id_fkey"
            columns: ["masterplan_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      dld_comparables: {
        Row: {
          area_slug: string | null
          bedrooms: number | null
          built_up_ft2: number | null
          id: string
          imported_at: string
          price_aed: number
          property_type: string
          source: string
          transaction_date: string
        }
        Insert: {
          area_slug?: string | null
          bedrooms?: number | null
          built_up_ft2?: number | null
          id?: string
          imported_at?: string
          price_aed: number
          property_type: string
          source?: string
          transaction_date: string
        }
        Update: {
          area_slug?: string | null
          bedrooms?: number | null
          built_up_ft2?: number | null
          id?: string
          imported_at?: string
          price_aed?: number
          property_type?: string
          source?: string
          transaction_date?: string
        }
        Relationships: []
      }
      dsr_requests: {
        Row: {
          account_id: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          fulfilled_at: string | null
          id: string
          ip: unknown
          kind: Database["public"]["Enums"]["dsr_kind"]
          payload: Json | null
          status: Database["public"]["Enums"]["dsr_status"]
          token: string
          user_agent: string | null
        }
        Insert: {
          account_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          fulfilled_at?: string | null
          id?: string
          ip?: unknown
          kind: Database["public"]["Enums"]["dsr_kind"]
          payload?: Json | null
          status?: Database["public"]["Enums"]["dsr_status"]
          token: string
          user_agent?: string | null
        }
        Update: {
          account_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          fulfilled_at?: string | null
          id?: string
          ip?: unknown
          kind?: Database["public"]["Enums"]["dsr_kind"]
          payload?: Json | null
          status?: Database["public"]["Enums"]["dsr_status"]
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dsr_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      enquiries: {
        Row: {
          account_id: string | null
          ack_sent_at: string | null
          assigned_agent_id: string | null
          brief_raw: string | null
          budget_max: number | null
          budget_min: number | null
          close_reason: string | null
          closed_at: string | null
          created_at: string
          development_id: string | null
          email: string | null
          escalated_at: string | null
          first_response_at: string | null
          id: string
          inferred_constraints: Json | null
          internal_notes: string | null
          locale: string
          name: string
          phone: string | null
          pre_approved: boolean
          property_id: string | null
          source: Database["public"]["Enums"]["enquiry_source"]
          status: Database["public"]["Enums"]["enquiry_status"]
          temperature: Database["public"]["Enums"]["enquiry_temperature"]
          timeline: Database["public"]["Enums"]["enquiry_timeline"] | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          ack_sent_at?: string | null
          assigned_agent_id?: string | null
          brief_raw?: string | null
          budget_max?: number | null
          budget_min?: number | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          development_id?: string | null
          email?: string | null
          escalated_at?: string | null
          first_response_at?: string | null
          id?: string
          inferred_constraints?: Json | null
          internal_notes?: string | null
          locale?: string
          name: string
          phone?: string | null
          pre_approved?: boolean
          property_id?: string | null
          source: Database["public"]["Enums"]["enquiry_source"]
          status?: Database["public"]["Enums"]["enquiry_status"]
          temperature?: Database["public"]["Enums"]["enquiry_temperature"]
          timeline?: Database["public"]["Enums"]["enquiry_timeline"] | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          ack_sent_at?: string | null
          assigned_agent_id?: string | null
          brief_raw?: string | null
          budget_max?: number | null
          budget_min?: number | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          development_id?: string | null
          email?: string | null
          escalated_at?: string | null
          first_response_at?: string | null
          id?: string
          inferred_constraints?: Json | null
          internal_notes?: string | null
          locale?: string
          name?: string
          phone?: string | null
          pre_approved?: boolean
          property_id?: string | null
          source?: Database["public"]["Enums"]["enquiry_source"]
          status?: Database["public"]["Enums"]["enquiry_status"]
          temperature?: Database["public"]["Enums"]["enquiry_temperature"]
          timeline?: Database["public"]["Enums"]["enquiry_timeline"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "enquiries_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "enquiries_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      floating_ctas: {
        Row: {
          cc_destination: string | null
          color: string | null
          created_at: string
          destination: string | null
          enabled: boolean
          id: string
          key: string
          kind: string
          label: string
          label_ar: string | null
          message_template: string | null
          message_template_ar: string | null
          scope: string
          sort_order: number
          subject_template: string | null
          subject_template_ar: string | null
          updated_at: string
          use_advisor_contact: boolean
        }
        Insert: {
          cc_destination?: string | null
          color?: string | null
          created_at?: string
          destination?: string | null
          enabled?: boolean
          id?: string
          key: string
          kind: string
          label: string
          label_ar?: string | null
          message_template?: string | null
          message_template_ar?: string | null
          scope?: string
          sort_order?: number
          subject_template?: string | null
          subject_template_ar?: string | null
          updated_at?: string
          use_advisor_contact?: boolean
        }
        Update: {
          cc_destination?: string | null
          color?: string | null
          created_at?: string
          destination?: string | null
          enabled?: boolean
          id?: string
          key?: string
          kind?: string
          label?: string
          label_ar?: string | null
          message_template?: string | null
          message_template_ar?: string | null
          scope?: string
          sort_order?: number
          subject_template?: string | null
          subject_template_ar?: string | null
          updated_at?: string
          use_advisor_contact?: boolean
        }
        Relationships: []
      }
      floor_plans: {
        Row: {
          area_ft2: number | null
          baths: number | null
          beds: number | null
          created_at: string
          description: string | null
          description_ar: string | null
          development_id: string
          enabled: boolean
          id: string
          label: string
          label_ar: string | null
          media_id: string | null
          sort_order: number
          unit_type_id: string | null
          updated_at: string
        }
        Insert: {
          area_ft2?: number | null
          baths?: number | null
          beds?: number | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          development_id: string
          enabled?: boolean
          id?: string
          label: string
          label_ar?: string | null
          media_id?: string | null
          sort_order?: number
          unit_type_id?: string | null
          updated_at?: string
        }
        Update: {
          area_ft2?: number | null
          baths?: number | null
          beds?: number | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          development_id?: string
          enabled?: boolean
          id?: string
          label?: string
          label_ar?: string | null
          media_id?: string | null
          sort_order?: number
          unit_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_unit_type_id_fkey"
            columns: ["unit_type_id"]
            isOneToOne: false
            referencedRelation: "development_unit_types"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          enabled: boolean
          form_id: string
          help: string | null
          help_ar: string | null
          id: string
          key: string
          label: string
          label_ar: string | null
          locked: boolean
          mapping: string
          max_value: number | null
          min_value: number | null
          option_source: string | null
          options: Json
          placeholder: string | null
          placeholder_ar: string | null
          position: number
          required: boolean
          rows: number | null
          show_when: Json | null
          step: number | null
          type: string
          unit: string | null
          unit_ar: string | null
          updated_at: string
          width: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          form_id: string
          help?: string | null
          help_ar?: string | null
          id?: string
          key: string
          label: string
          label_ar?: string | null
          locked?: boolean
          mapping?: string
          max_value?: number | null
          min_value?: number | null
          option_source?: string | null
          options?: Json
          placeholder?: string | null
          placeholder_ar?: string | null
          position?: number
          required?: boolean
          rows?: number | null
          show_when?: Json | null
          step?: number | null
          type: string
          unit?: string | null
          unit_ar?: string | null
          updated_at?: string
          width?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          form_id?: string
          help?: string | null
          help_ar?: string | null
          id?: string
          key?: string
          label?: string
          label_ar?: string | null
          locked?: boolean
          mapping?: string
          max_value?: number | null
          min_value?: number | null
          option_source?: string | null
          options?: Json
          placeholder?: string | null
          placeholder_ar?: string | null
          position?: number
          required?: boolean
          rows?: number | null
          show_when?: Json | null
          step?: number | null
          type?: string
          unit?: string | null
          unit_ar?: string | null
          updated_at?: string
          width?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          created_at: string
          data: Json
          enquiry_id: string | null
          form_key: string
          id: string
          read_at: string | null
          read_by: string | null
          source_path: string | null
          status: string
        }
        Insert: {
          created_at?: string
          data?: Json
          enquiry_id?: string | null
          form_key: string
          id?: string
          read_at?: string | null
          read_by?: string | null
          source_path?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data?: Json
          enquiry_id?: string | null
          form_key?: string
          id?: string
          read_at?: string | null
          read_by?: string | null
          source_path?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          copy: Json
          created_at: string
          enabled: boolean
          id: string
          key: string
          notify_emails: string[]
          updated_at: string
        }
        Insert: {
          copy?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          notify_emails?: string[]
          updated_at?: string
        }
        Update: {
          copy?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          notify_emails?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          kind: Database["public"]["Enums"]["integration_kind"]
          last_error: string | null
          last_error_at: string | null
          last_synced_at: string | null
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          kind: Database["public"]["Enums"]["integration_kind"]
          last_error?: string | null
          last_error_at?: string | null
          last_synced_at?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          kind?: Database["public"]["Enums"]["integration_kind"]
          last_error?: string | null
          last_error_at?: string | null
          last_synced_at?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: []
      }
      landing_pages: {
        Row: {
          blocks: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          draft_blocks: Json | null
          id: string
          noindex: boolean
          published_at: string | null
          seo: Json | null
          slug: string
          status: Database["public"]["Enums"]["page_status"]
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          draft_blocks?: Json | null
          id?: string
          noindex?: boolean
          published_at?: string | null
          seo?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["page_status"]
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          draft_blocks?: Json | null
          id?: string
          noindex?: boolean
          published_at?: string | null
          seo?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["page_status"]
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      licenses: {
        Row: {
          created_at: string
          expires_at: string
          file_id: string | null
          holder_id: string | null
          holder_kind: Database["public"]["Enums"]["license_holder_kind"]
          id: string
          issued_at: string | null
          kind: Database["public"]["Enums"]["license_kind"]
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          file_id?: string | null
          holder_id?: string | null
          holder_kind: Database["public"]["Enums"]["license_holder_kind"]
          id?: string
          issued_at?: string | null
          kind: Database["public"]["Enums"]["license_kind"]
          notes?: string | null
          number: string
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          file_id?: string | null
          holder_id?: string | null
          holder_kind?: Database["public"]["Enums"]["license_holder_kind"]
          id?: string
          issued_at?: string | null
          kind?: Database["public"]["Enums"]["license_kind"]
          notes?: string | null
          number?: string
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          alt_text_ar: string | null
          created_at: string
          deleted_at: string | null
          filename: string
          folder: Database["public"]["Enums"]["media_folder"]
          height: number | null
          i18n: Json
          id: string
          mime_type: string
          size_bytes: number | null
          storage_key: string
          updated_at: string
          uploaded_by: string | null
          usage_count: number
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          alt_text_ar?: string | null
          created_at?: string
          deleted_at?: string | null
          filename: string
          folder?: Database["public"]["Enums"]["media_folder"]
          height?: number | null
          i18n?: Json
          id?: string
          mime_type: string
          size_bytes?: number | null
          storage_key: string
          updated_at?: string
          uploaded_by?: string | null
          usage_count?: number
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          alt_text_ar?: string | null
          created_at?: string
          deleted_at?: string | null
          filename?: string
          folder?: Database["public"]["Enums"]["media_folder"]
          height?: number | null
          i18n?: Json
          id?: string
          mime_type?: string
          size_bytes?: number | null
          storage_key?: string
          updated_at?: string
          uploaded_by?: string | null
          usage_count?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      megamenu_columns: {
        Row: {
          created_at: string
          heading: string | null
          heading_ar: string | null
          id: string
          position: number
          tab_id: string
          updated_at: string
          zone: Database["public"]["Enums"]["megamenu_zone"]
        }
        Insert: {
          created_at?: string
          heading?: string | null
          heading_ar?: string | null
          id?: string
          position: number
          tab_id: string
          updated_at?: string
          zone: Database["public"]["Enums"]["megamenu_zone"]
        }
        Update: {
          created_at?: string
          heading?: string | null
          heading_ar?: string | null
          id?: string
          position?: number
          tab_id?: string
          updated_at?: string
          zone?: Database["public"]["Enums"]["megamenu_zone"]
        }
        Relationships: [
          {
            foreignKeyName: "megamenu_columns_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "megamenu_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      megamenu_featured_tiles: {
        Row: {
          badge_kind: Database["public"]["Enums"]["megamenu_tile_badge_kind"]
          badge_label: string | null
          badge_label_ar: string | null
          created_at: string
          cta_label: string | null
          cta_label_ar: string | null
          headline: string
          headline_ar: string | null
          href: string
          id: string
          media_asset_id: string | null
          position: number
          tab_id: string
          updated_at: string
          variant: Database["public"]["Enums"]["megamenu_tile_variant"]
        }
        Insert: {
          badge_kind?: Database["public"]["Enums"]["megamenu_tile_badge_kind"]
          badge_label?: string | null
          badge_label_ar?: string | null
          created_at?: string
          cta_label?: string | null
          cta_label_ar?: string | null
          headline: string
          headline_ar?: string | null
          href: string
          id?: string
          media_asset_id?: string | null
          position: number
          tab_id: string
          updated_at?: string
          variant?: Database["public"]["Enums"]["megamenu_tile_variant"]
        }
        Update: {
          badge_kind?: Database["public"]["Enums"]["megamenu_tile_badge_kind"]
          badge_label?: string | null
          badge_label_ar?: string | null
          created_at?: string
          cta_label?: string | null
          cta_label_ar?: string | null
          headline?: string
          headline_ar?: string | null
          href?: string
          id?: string
          media_asset_id?: string | null
          position?: number
          tab_id?: string
          updated_at?: string
          variant?: Database["public"]["Enums"]["megamenu_tile_variant"]
        }
        Relationships: [
          {
            foreignKeyName: "megamenu_featured_tiles_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "megamenu_featured_tiles_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "megamenu_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      megamenu_items: {
        Row: {
          badge_label: string | null
          badge_label_ar: string | null
          badge_variant: Database["public"]["Enums"]["megamenu_badge_variant"]
          column_id: string
          created_at: string
          href: string
          icon: string | null
          id: string
          label: string
          label_ar: string | null
          position: number
          target_id: string | null
          target_kind:
            | Database["public"]["Enums"]["megamenu_target_kind"]
            | null
          updated_at: string
        }
        Insert: {
          badge_label?: string | null
          badge_label_ar?: string | null
          badge_variant?: Database["public"]["Enums"]["megamenu_badge_variant"]
          column_id: string
          created_at?: string
          href: string
          icon?: string | null
          id?: string
          label: string
          label_ar?: string | null
          position: number
          target_id?: string | null
          target_kind?:
            | Database["public"]["Enums"]["megamenu_target_kind"]
            | null
          updated_at?: string
        }
        Update: {
          badge_label?: string | null
          badge_label_ar?: string | null
          badge_variant?: Database["public"]["Enums"]["megamenu_badge_variant"]
          column_id?: string
          created_at?: string
          href?: string
          icon?: string | null
          id?: string
          label?: string
          label_ar?: string | null
          position?: number
          target_id?: string | null
          target_kind?:
            | Database["public"]["Enums"]["megamenu_target_kind"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "megamenu_items_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "megamenu_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      megamenu_tabs: {
        Row: {
          created_at: string
          has_panel: boolean
          href: string | null
          id: string
          label: string
          label_ar: string | null
          panel_title: string | null
          panel_title_ar: string | null
          panel_title_href: string | null
          position: number
          published_at: string | null
          right_column_title: string | null
          right_column_title_ar: string | null
          slug: string
          status: Database["public"]["Enums"]["megamenu_tab_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          has_panel?: boolean
          href?: string | null
          id?: string
          label: string
          label_ar?: string | null
          panel_title?: string | null
          panel_title_ar?: string | null
          panel_title_href?: string | null
          position: number
          published_at?: string | null
          right_column_title?: string | null
          right_column_title_ar?: string | null
          slug: string
          status?: Database["public"]["Enums"]["megamenu_tab_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          has_panel?: boolean
          href?: string | null
          id?: string
          label?: string
          label_ar?: string | null
          panel_title?: string | null
          panel_title_ar?: string | null
          panel_title_href?: string | null
          position?: number
          published_at?: string | null
          right_column_title?: string | null
          right_column_title_ar?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["megamenu_tab_status"]
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json | null
          author_id: string | null
          author_kind: Database["public"]["Enums"]["message_author_kind"]
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_id: string | null
          id: string
          read_at: string | null
          sent_at: string
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          author_kind: Database["public"]["Enums"]["message_author_kind"]
          body: string
          channel?: Database["public"]["Enums"]["message_channel"]
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          author_kind?: Database["public"]["Enums"]["message_author_kind"]
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mortgage_inquiries: {
        Row: {
          account_id: string | null
          annual_income_aed: number | null
          applicant_email: string
          applicant_name: string
          applicant_phone: string | null
          assigned_advisor_id: string | null
          buyer_status: Database["public"]["Enums"]["mortgage_buyer_status"]
          created_at: string
          down_payment_aed: number
          id: string
          interest_rate_pct: number
          mortgage_type: Database["public"]["Enums"]["mortgage_loan_type"]
          notes: string | null
          property_price_aed: number
          status: Database["public"]["Enums"]["mortgage_inquiry_status"]
          term_years: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          annual_income_aed?: number | null
          applicant_email: string
          applicant_name: string
          applicant_phone?: string | null
          assigned_advisor_id?: string | null
          buyer_status: Database["public"]["Enums"]["mortgage_buyer_status"]
          created_at?: string
          down_payment_aed: number
          id?: string
          interest_rate_pct: number
          mortgage_type: Database["public"]["Enums"]["mortgage_loan_type"]
          notes?: string | null
          property_price_aed: number
          status?: Database["public"]["Enums"]["mortgage_inquiry_status"]
          term_years: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          annual_income_aed?: number | null
          applicant_email?: string
          applicant_name?: string
          applicant_phone?: string | null
          assigned_advisor_id?: string | null
          buyer_status?: Database["public"]["Enums"]["mortgage_buyer_status"]
          created_at?: string
          down_payment_aed?: number
          id?: string
          interest_rate_pct?: number
          mortgage_type?: Database["public"]["Enums"]["mortgage_loan_type"]
          notes?: string | null
          property_price_aed?: number
          status?: Database["public"]["Enums"]["mortgage_inquiry_status"]
          term_years?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mortgage_inquiries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mortgage_inquiries_assigned_advisor_id_fkey"
            columns: ["assigned_advisor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          account_id: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          locale: string
          source: string | null
          status: Database["public"]["Enums"]["newsletter_status"]
          subscribed_at: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          locale?: string
          source?: string | null
          status?: Database["public"]["Enums"]["newsletter_status"]
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          locale?: string
          source?: string | null
          status?: Database["public"]["Enums"]["newsletter_status"]
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          payload: Json | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          payload?: Json | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          payload?: Json | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          channel: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          identifier: string
          ip: string | null
          max_attempts: number
          purpose: string
          user_agent: string | null
        }
        Insert: {
          attempts?: number
          channel: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          ip?: string | null
          max_attempts?: number
          purpose: string
          user_agent?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          ip?: string | null
          max_attempts?: number
          purpose?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      pages: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          published_at: string | null
          seo: Json | null
          slug: string
          status: Database["public"]["Enums"]["page_status"]
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          published_at?: string | null
          seo?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["page_status"]
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          published_at?: string | null
          seo?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["page_status"]
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_line: string | null
          address_line_ar: string | null
          advisor_note: string | null
          amenities: string[]
          area_id: string | null
          assigned_agent_id: string | null
          baths: number
          bazar_verified: boolean
          beds: number
          building_id: string | null
          built_up_ft2: number | null
          compliance: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          description_ar: string | null
          developer_id: string | null
          development_id: string | null
          dld_plot_number: string | null
          enquiry_count: number
          featured_on_homepage: boolean
          flags: Json
          floor: number | null
          furnishing: Database["public"]["Enums"]["property_furnishing"] | null
          geo: Json | null
          i18n: Json
          id: string
          listing_permit_expires_at: string | null
          listing_permit_no: string | null
          mode: Database["public"]["Enums"]["property_mode"]
          orientation: string | null
          orientation_ar: string | null
          parking_bays: number | null
          plot_ft2: number | null
          price_aed: number
          price_history: Json
          property_form: Database["public"]["Enums"]["property_form"] | null
          published_at: string | null
          reference: string
          search_text: unknown
          search_text_ar: unknown
          seo: Json | null
          service_charge_per_ft2: number | null
          short_description: string | null
          short_description_ar: string | null
          slug: string
          sold_at: string | null
          status: Database["public"]["Enums"]["property_status"]
          sub_community_id: string | null
          tenure: Database["public"]["Enums"]["property_tenure"] | null
          title: string
          title_ar: string | null
          type: Database["public"]["Enums"]["property_type"]
          unit_number: string | null
          updated_at: string
          view: string | null
          view_ar: string | null
          view_count: number
          year_built: number | null
        }
        Insert: {
          address_line?: string | null
          address_line_ar?: string | null
          advisor_note?: string | null
          amenities?: string[]
          area_id?: string | null
          assigned_agent_id?: string | null
          baths?: number
          bazar_verified?: boolean
          beds?: number
          building_id?: string | null
          built_up_ft2?: number | null
          compliance?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          description_ar?: string | null
          developer_id?: string | null
          development_id?: string | null
          dld_plot_number?: string | null
          enquiry_count?: number
          featured_on_homepage?: boolean
          flags?: Json
          floor?: number | null
          furnishing?: Database["public"]["Enums"]["property_furnishing"] | null
          geo?: Json | null
          i18n?: Json
          id?: string
          listing_permit_expires_at?: string | null
          listing_permit_no?: string | null
          mode: Database["public"]["Enums"]["property_mode"]
          orientation?: string | null
          orientation_ar?: string | null
          parking_bays?: number | null
          plot_ft2?: number | null
          price_aed: number
          price_history?: Json
          property_form?: Database["public"]["Enums"]["property_form"] | null
          published_at?: string | null
          reference: string
          search_text?: unknown
          search_text_ar?: unknown
          seo?: Json | null
          service_charge_per_ft2?: number | null
          short_description?: string | null
          short_description_ar?: string | null
          slug: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          sub_community_id?: string | null
          tenure?: Database["public"]["Enums"]["property_tenure"] | null
          title: string
          title_ar?: string | null
          type: Database["public"]["Enums"]["property_type"]
          unit_number?: string | null
          updated_at?: string
          view?: string | null
          view_ar?: string | null
          view_count?: number
          year_built?: number | null
        }
        Update: {
          address_line?: string | null
          address_line_ar?: string | null
          advisor_note?: string | null
          amenities?: string[]
          area_id?: string | null
          assigned_agent_id?: string | null
          baths?: number
          bazar_verified?: boolean
          beds?: number
          building_id?: string | null
          built_up_ft2?: number | null
          compliance?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          description_ar?: string | null
          developer_id?: string | null
          development_id?: string | null
          dld_plot_number?: string | null
          enquiry_count?: number
          featured_on_homepage?: boolean
          flags?: Json
          floor?: number | null
          furnishing?: Database["public"]["Enums"]["property_furnishing"] | null
          geo?: Json | null
          i18n?: Json
          id?: string
          listing_permit_expires_at?: string | null
          listing_permit_no?: string | null
          mode?: Database["public"]["Enums"]["property_mode"]
          orientation?: string | null
          orientation_ar?: string | null
          parking_bays?: number | null
          plot_ft2?: number | null
          price_aed?: number
          price_history?: Json
          property_form?: Database["public"]["Enums"]["property_form"] | null
          published_at?: string | null
          reference?: string
          search_text?: unknown
          search_text_ar?: unknown
          seo?: Json | null
          service_charge_per_ft2?: number | null
          short_description?: string | null
          short_description_ar?: string | null
          slug?: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          sub_community_id?: string | null
          tenure?: Database["public"]["Enums"]["property_tenure"] | null
          title?: string
          title_ar?: string | null
          type?: Database["public"]["Enums"]["property_type"]
          unit_number?: string | null
          updated_at?: string
          view?: string | null
          view_ar?: string | null
          view_count?: number
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "properties_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "properties_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_sub_community_id_fkey"
            columns: ["sub_community_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      property_embeddings: {
        Row: {
          embedded_at: string | null
          embedding: string | null
          model: string
          property_id: string
          source_text: string | null
          updated_at: string
        }
        Insert: {
          embedded_at?: string | null
          embedding?: string | null
          model?: string
          property_id: string
          source_text?: string | null
          updated_at?: string
        }
        Update: {
          embedded_at?: string | null
          embedding?: string | null
          model?: string
          property_id?: string
          source_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_embeddings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media: {
        Row: {
          created_at: string
          media_id: string
          property_id: string
          role: Database["public"]["Enums"]["property_media_role"]
          sort_order: number
        }
        Insert: {
          created_at?: string
          media_id: string
          property_id: string
          role?: Database["public"]["Enums"]["property_media_role"]
          sort_order?: number
        }
        Update: {
          created_at?: string
          media_id?: string
          property_id?: string
          role?: Database["public"]["Enums"]["property_media_role"]
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          account_id: string | null
          author_email: string | null
          author_name: string | null
          body: string | null
          created_at: string
          id: string
          locale: string
          moderated_at: string | null
          moderated_by: string | null
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          subject_id: string
          subject_kind: Database["public"]["Enums"]["review_subject_kind"]
          title: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          author_email?: string | null
          author_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          locale?: string
          moderated_at?: string | null
          moderated_by?: string | null
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          subject_id: string
          subject_kind: Database["public"]["Enums"]["review_subject_kind"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          author_email?: string | null
          author_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          locale?: string
          moderated_at?: string | null
          moderated_by?: string | null
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          subject_id?: string
          subject_kind?: Database["public"]["Enums"]["review_subject_kind"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      roles_custom: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          accent_token: string
          brand_name: string
          brand_name_ar: string | null
          brand_tagline: string | null
          brand_tagline_ar: string | null
          contact_email: string | null
          contact_phone: string | null
          email_templates: Json
          favicon_url: string | null
          footer_logo_url: string | null
          hero_variant: string
          id: number
          integrations: Json
          lead_routing: Json
          logo_style: string
          logo_url: string | null
          mortgage: Json
          orn: string | null
          search_logo_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_token?: string
          brand_name?: string
          brand_name_ar?: string | null
          brand_tagline?: string | null
          brand_tagline_ar?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          email_templates?: Json
          favicon_url?: string | null
          footer_logo_url?: string | null
          hero_variant?: string
          id?: number
          integrations?: Json
          lead_routing?: Json
          logo_style?: string
          logo_url?: string | null
          mortgage?: Json
          orn?: string | null
          search_logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_token?: string
          brand_name?: string
          brand_name_ar?: string | null
          brand_tagline?: string | null
          brand_tagline_ar?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          email_templates?: Json
          favicon_url?: string | null
          footer_logo_url?: string | null
          hero_variant?: string
          id?: number
          integrations?: Json
          lead_routing?: Json
          logo_style?: string
          logo_url?: string | null
          mortgage?: Json
          orn?: string | null
          search_logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staff: {
        Row: {
          bio: string | null
          bio_ar: string | null
          brn: string | null
          created_at: string
          credentials: string[]
          display_name: string
          display_name_ar: string | null
          joined_at: string | null
          languages: Json
          languages_ar: Json | null
          photo_url: string | null
          public_email: string | null
          public_phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          slug: string
          specialties: string[]
          specialties_ar: string[] | null
          status: Database["public"]["Enums"]["staff_status"]
          title: string | null
          title_ar: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          bio?: string | null
          bio_ar?: string | null
          brn?: string | null
          created_at?: string
          credentials?: string[]
          display_name: string
          display_name_ar?: string | null
          joined_at?: string | null
          languages?: Json
          languages_ar?: Json | null
          photo_url?: string | null
          public_email?: string | null
          public_phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          slug: string
          specialties?: string[]
          specialties_ar?: string[] | null
          status?: Database["public"]["Enums"]["staff_status"]
          title?: string | null
          title_ar?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          bio?: string | null
          bio_ar?: string | null
          brn?: string | null
          created_at?: string
          credentials?: string[]
          display_name?: string
          display_name_ar?: string | null
          joined_at?: string | null
          languages?: Json
          languages_ar?: Json | null
          photo_url?: string | null
          public_email?: string | null
          public_phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          slug?: string
          specialties?: string[]
          specialties_ar?: string[] | null
          status?: Database["public"]["Enums"]["staff_status"]
          title?: string | null
          title_ar?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          activated_at: string | null
          created_at: string
          display_name: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          purpose: string
          role: Database["public"]["Enums"]["staff_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          activated_at?: string | null
          created_at?: string
          display_name: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          purpose?: string
          role?: Database["public"]["Enums"]["staff_role"]
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          activated_at?: string | null
          created_at?: string
          display_name?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          purpose?: string
          role?: Database["public"]["Enums"]["staff_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      valuation_requests: {
        Row: {
          account_id: string | null
          address_line: string | null
          advisor_estimate_aed: number | null
          advisor_notes: string | null
          area_id: string | null
          assigned_advisor_id: string | null
          baths: number
          beds: number
          building_name: string | null
          built_up_ft2: number | null
          condition: Database["public"]["Enums"]["valuation_condition"] | null
          created_at: string
          estimate_basis: Json | null
          estimate_high_aed: number | null
          estimate_low_aed: number | null
          estimate_mid_aed: number | null
          floor: number | null
          furnishing: Database["public"]["Enums"]["property_furnishing"] | null
          id: string
          marketing_opt_in: boolean
          mortgage_state:
            | Database["public"]["Enums"]["valuation_mortgage_state"]
            | null
          nurture_day30_at: string | null
          nurture_day7_at: string | null
          owner_email: string
          owner_name: string
          owner_phone: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          reviewed_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["valuation_status"]
          tenancy: Database["public"]["Enums"]["valuation_tenancy"] | null
          unit_number: string | null
          updated_at: string
          upgrades: string[]
          view_description: string | null
        }
        Insert: {
          account_id?: string | null
          address_line?: string | null
          advisor_estimate_aed?: number | null
          advisor_notes?: string | null
          area_id?: string | null
          assigned_advisor_id?: string | null
          baths: number
          beds: number
          building_name?: string | null
          built_up_ft2?: number | null
          condition?: Database["public"]["Enums"]["valuation_condition"] | null
          created_at?: string
          estimate_basis?: Json | null
          estimate_high_aed?: number | null
          estimate_low_aed?: number | null
          estimate_mid_aed?: number | null
          floor?: number | null
          furnishing?: Database["public"]["Enums"]["property_furnishing"] | null
          id?: string
          marketing_opt_in?: boolean
          mortgage_state?:
            | Database["public"]["Enums"]["valuation_mortgage_state"]
            | null
          nurture_day30_at?: string | null
          nurture_day7_at?: string | null
          owner_email: string
          owner_name: string
          owner_phone?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          reviewed_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["valuation_status"]
          tenancy?: Database["public"]["Enums"]["valuation_tenancy"] | null
          unit_number?: string | null
          updated_at?: string
          upgrades?: string[]
          view_description?: string | null
        }
        Update: {
          account_id?: string | null
          address_line?: string | null
          advisor_estimate_aed?: number | null
          advisor_notes?: string | null
          area_id?: string | null
          assigned_advisor_id?: string | null
          baths?: number
          beds?: number
          building_name?: string | null
          built_up_ft2?: number | null
          condition?: Database["public"]["Enums"]["valuation_condition"] | null
          created_at?: string
          estimate_basis?: Json | null
          estimate_high_aed?: number | null
          estimate_low_aed?: number | null
          estimate_mid_aed?: number | null
          floor?: number | null
          furnishing?: Database["public"]["Enums"]["property_furnishing"] | null
          id?: string
          marketing_opt_in?: boolean
          mortgage_state?:
            | Database["public"]["Enums"]["valuation_mortgage_state"]
            | null
          nurture_day30_at?: string | null
          nurture_day7_at?: string | null
          owner_email?: string
          owner_name?: string
          owner_phone?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          reviewed_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["valuation_status"]
          tenancy?: Database["public"]["Enums"]["valuation_tenancy"] | null
          unit_number?: string | null
          updated_at?: string
          upgrades?: string[]
          view_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "valuation_requests_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_requests_assigned_advisor_id_fkey"
            columns: ["assigned_advisor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      viewings: {
        Row: {
          account_id: string | null
          agent_id: string | null
          created_at: string
          duration_minutes: number
          enquiry_id: string | null
          feedback: string | null
          id: string
          location: string | null
          notes: string | null
          property_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["viewing_status"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          agent_id?: string | null
          created_at?: string
          duration_minutes?: number
          enquiry_id?: string | null
          feedback?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          property_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["viewing_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          agent_id?: string | null
          created_at?: string
          duration_minutes?: number
          enquiry_id?: string | null
          feedback?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          property_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["viewing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "viewings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "viewings_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: Database["public"]["Enums"]["webhook_event"][]
          failure_count: number
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          name: string
          secret: string
          status: Database["public"]["Enums"]["webhook_status"]
          target_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events: Database["public"]["Enums"]["webhook_event"][]
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          name: string
          secret: string
          status?: Database["public"]["Enums"]["webhook_status"]
          target_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: Database["public"]["Enums"]["webhook_event"][]
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          name?: string
          secret?: string
          status?: Database["public"]["Enums"]["webhook_status"]
          target_url?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymise_account: { Args: { target: string }; Returns: undefined }
      anonymise_by_email: { Args: { target_email: string }; Returns: Json }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      functions_base_url: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      match_properties: {
        Args: { match_limit?: number; query_embedding: string }
        Returns: {
          distance: number
          property_id: string
        }[]
      }
    }
    Enums: {
      account_kyc_status: "unverified" | "pending" | "verified" | "rejected"
      account_language: "en" | "ar"
      account_residency_status: "uae_resident" | "non_resident" | "gcc_national"
      alert_frequency: "off" | "instant" | "daily" | "weekly"
      amenity_category:
        | "indoor"
        | "outdoor"
        | "building"
        | "community"
        | "view"
        | "security"
        | "wellness"
      api_key_role:
        | "read_only"
        | "read_write"
        | "webhook_dispatch"
        | "syndication"
      api_key_status: "active" | "revoked"
      area_kind: "emirate" | "area" | "sub_community" | "building"
      article_status: "draft" | "scheduled" | "published" | "archived"
      audit_actor_kind: "user" | "system" | "integration"
      bulk_action_kind:
        | "bulk_update"
        | "bulk_publish"
        | "bulk_off_market"
        | "bulk_reassign"
        | "bulk_archive"
      concierge_message_role: "user" | "assistant" | "system"
      content_asset_kind: "email" | "whatsapp"
      content_asset_status: "draft" | "published"
      development_media_role:
        | "hero"
        | "gallery"
        | "render"
        | "masterplan"
        | "brochure"
        | "video"
      development_status: "pre_launch" | "on_sale" | "sold_out" | "handed_over"
      development_unit_status: "available" | "held" | "reserved" | "sold"
      dsr_kind: "export" | "delete"
      dsr_status: "pending" | "fulfilled" | "expired" | "cancelled"
      enquiry_source:
        | "property_page"
        | "contact_page"
        | "concierge"
        | "valuation"
        | "mortgage"
        | "blog_cta"
        | "agent_page"
        | "share_with_advisor"
        | "whatsapp_inbound"
        | "brochure"
        | "development_interest"
        | "list_property"
        | "property_management"
        | "property_consultation"
      enquiry_status:
        | "new"
        | "qualified"
        | "viewing_scheduled"
        | "offer"
        | "closed_won"
        | "closed_lost"
      enquiry_temperature: "cold" | "warm" | "hot"
      enquiry_timeline:
        | "now"
        | "three_months"
        | "six_months"
        | "twelve_months"
        | "browsing"
      integration_kind:
        | "mapbox"
        | "meilisearch"
        | "voyage_ai"
        | "property_finder"
        | "bayut"
        | "mailchimp"
        | "whatsapp_cloud"
        | "dld_open_data"
        | "docusign"
        | "posthog"
        | "sentry"
        | "resend"
      integration_status: "disconnected" | "connected" | "error" | "paused"
      license_holder_kind: "firm" | "staff" | "development"
      license_kind: "orn" | "brn" | "trakheesi" | "rera" | "dmt"
      license_status: "active" | "expiring_soon" | "expired" | "revoked"
      media_folder: "listings" | "brand" | "blog" | "team" | "documents"
      megamenu_badge_variant:
        | "default"
        | "hot"
        | "luxury"
        | "new"
        | "trending"
        | "partner"
      megamenu_tab_status: "draft" | "published"
      megamenu_target_kind:
        | "area"
        | "developer"
        | "service"
        | "property_type"
        | "transaction"
        | "page"
        | "development"
        | "article"
        | "external"
      megamenu_tile_badge_kind: "dot" | "icon" | "none"
      megamenu_tile_variant: "dark" | "light" | "image"
      megamenu_zone: "left" | "right"
      message_author_kind: "lead" | "staff" | "system" | "ai"
      message_channel: "web" | "email" | "whatsapp" | "sms" | "call"
      message_direction: "inbound" | "outbound"
      mortgage_buyer_status: "uae_resident" | "non_resident" | "gcc_national"
      mortgage_inquiry_status:
        | "new"
        | "contacted"
        | "in_progress"
        | "pre_approved"
        | "closed"
      mortgage_loan_type: "fixed" | "variable" | "hybrid"
      newsletter_status: "pending" | "confirmed" | "unsubscribed" | "bounced"
      notification_kind:
        | "new_enquiry"
        | "viewing_reminder"
        | "lead_reassigned"
        | "system"
      page_status: "draft" | "published"
      property_form: "off_plan" | "ready_new" | "resale"
      property_furnishing: "unfurnished" | "semi" | "fully"
      property_media_role:
        | "hero"
        | "gallery"
        | "floor_plan"
        | "brochure"
        | "video"
        | "virtual_tour"
      property_mode: "buy" | "rent" | "off_plan" | "commercial"
      property_status:
        | "draft"
        | "in_review"
        | "published"
        | "off_market"
        | "archived"
      property_tenure: "freehold" | "leasehold" | "usufruct"
      property_type:
        | "apartment"
        | "villa"
        | "penthouse"
        | "townhouse"
        | "commercial"
        | "land"
        | "hotel_apartment"
        | "office"
        | "building"
        | "retail"
        | "commercial_villa"
      review_status: "pending" | "approved" | "rejected"
      review_subject_kind: "agent" | "area" | "development"
      staff_role: "admin" | "editor" | "agent" | "marketing" | "support"
      staff_status: "active" | "on_leave" | "onboarding" | "suspended"
      valuation_condition:
        | "original"
        | "lightly_refreshed"
        | "renovated"
        | "fully_renovated"
      valuation_mortgage_state: "no" | "yes_partial"
      valuation_status: "pending" | "in_review" | "sent" | "archived"
      valuation_tenancy: "vacant" | "rented_le_6mo" | "rented_gt_6mo"
      viewing_status:
        | "tentative"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      webhook_event:
        | "property.published"
        | "property.updated"
        | "property.archived"
        | "property.sold"
        | "enquiry.created"
        | "enquiry.assigned"
        | "viewing.scheduled"
        | "viewing.cancelled"
        | "deal.stage_changed"
        | "valuation.submitted"
        | "kyc.approved"
        | "kyc.rejected"
      webhook_status: "active" | "paused" | "failing"
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
      account_kyc_status: ["unverified", "pending", "verified", "rejected"],
      account_language: ["en", "ar"],
      account_residency_status: [
        "uae_resident",
        "non_resident",
        "gcc_national",
      ],
      alert_frequency: ["off", "instant", "daily", "weekly"],
      amenity_category: [
        "indoor",
        "outdoor",
        "building",
        "community",
        "view",
        "security",
        "wellness",
      ],
      api_key_role: [
        "read_only",
        "read_write",
        "webhook_dispatch",
        "syndication",
      ],
      api_key_status: ["active", "revoked"],
      area_kind: ["emirate", "area", "sub_community", "building"],
      article_status: ["draft", "scheduled", "published", "archived"],
      audit_actor_kind: ["user", "system", "integration"],
      bulk_action_kind: [
        "bulk_update",
        "bulk_publish",
        "bulk_off_market",
        "bulk_reassign",
        "bulk_archive",
      ],
      concierge_message_role: ["user", "assistant", "system"],
      content_asset_kind: ["email", "whatsapp"],
      content_asset_status: ["draft", "published"],
      development_media_role: [
        "hero",
        "gallery",
        "render",
        "masterplan",
        "brochure",
        "video",
      ],
      development_status: ["pre_launch", "on_sale", "sold_out", "handed_over"],
      development_unit_status: ["available", "held", "reserved", "sold"],
      dsr_kind: ["export", "delete"],
      dsr_status: ["pending", "fulfilled", "expired", "cancelled"],
      enquiry_source: [
        "property_page",
        "contact_page",
        "concierge",
        "valuation",
        "mortgage",
        "blog_cta",
        "agent_page",
        "share_with_advisor",
        "whatsapp_inbound",
        "brochure",
        "development_interest",
        "list_property",
        "property_management",
        "property_consultation",
      ],
      enquiry_status: [
        "new",
        "qualified",
        "viewing_scheduled",
        "offer",
        "closed_won",
        "closed_lost",
      ],
      enquiry_temperature: ["cold", "warm", "hot"],
      enquiry_timeline: [
        "now",
        "three_months",
        "six_months",
        "twelve_months",
        "browsing",
      ],
      integration_kind: [
        "mapbox",
        "meilisearch",
        "voyage_ai",
        "property_finder",
        "bayut",
        "mailchimp",
        "whatsapp_cloud",
        "dld_open_data",
        "docusign",
        "posthog",
        "sentry",
        "resend",
      ],
      integration_status: ["disconnected", "connected", "error", "paused"],
      license_holder_kind: ["firm", "staff", "development"],
      license_kind: ["orn", "brn", "trakheesi", "rera", "dmt"],
      license_status: ["active", "expiring_soon", "expired", "revoked"],
      media_folder: ["listings", "brand", "blog", "team", "documents"],
      megamenu_badge_variant: [
        "default",
        "hot",
        "luxury",
        "new",
        "trending",
        "partner",
      ],
      megamenu_tab_status: ["draft", "published"],
      megamenu_target_kind: [
        "area",
        "developer",
        "service",
        "property_type",
        "transaction",
        "page",
        "development",
        "article",
        "external",
      ],
      megamenu_tile_badge_kind: ["dot", "icon", "none"],
      megamenu_tile_variant: ["dark", "light", "image"],
      megamenu_zone: ["left", "right"],
      message_author_kind: ["lead", "staff", "system", "ai"],
      message_channel: ["web", "email", "whatsapp", "sms", "call"],
      message_direction: ["inbound", "outbound"],
      mortgage_buyer_status: ["uae_resident", "non_resident", "gcc_national"],
      mortgage_inquiry_status: [
        "new",
        "contacted",
        "in_progress",
        "pre_approved",
        "closed",
      ],
      mortgage_loan_type: ["fixed", "variable", "hybrid"],
      newsletter_status: ["pending", "confirmed", "unsubscribed", "bounced"],
      notification_kind: [
        "new_enquiry",
        "viewing_reminder",
        "lead_reassigned",
        "system",
      ],
      page_status: ["draft", "published"],
      property_form: ["off_plan", "ready_new", "resale"],
      property_furnishing: ["unfurnished", "semi", "fully"],
      property_media_role: [
        "hero",
        "gallery",
        "floor_plan",
        "brochure",
        "video",
        "virtual_tour",
      ],
      property_mode: ["buy", "rent", "off_plan", "commercial"],
      property_status: [
        "draft",
        "in_review",
        "published",
        "off_market",
        "archived",
      ],
      property_tenure: ["freehold", "leasehold", "usufruct"],
      property_type: [
        "apartment",
        "villa",
        "penthouse",
        "townhouse",
        "commercial",
        "land",
        "hotel_apartment",
        "office",
        "building",
        "retail",
        "commercial_villa",
      ],
      review_status: ["pending", "approved", "rejected"],
      review_subject_kind: ["agent", "area", "development"],
      staff_role: ["admin", "editor", "agent", "marketing", "support"],
      staff_status: ["active", "on_leave", "onboarding", "suspended"],
      valuation_condition: [
        "original",
        "lightly_refreshed",
        "renovated",
        "fully_renovated",
      ],
      valuation_mortgage_state: ["no", "yes_partial"],
      valuation_status: ["pending", "in_review", "sent", "archived"],
      valuation_tenancy: ["vacant", "rented_le_6mo", "rented_gt_6mo"],
      viewing_status: [
        "tentative",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      webhook_event: [
        "property.published",
        "property.updated",
        "property.archived",
        "property.sold",
        "enquiry.created",
        "enquiry.assigned",
        "viewing.scheduled",
        "viewing.cancelled",
        "deal.stage_changed",
        "valuation.submitted",
        "kyc.approved",
        "kyc.rejected",
      ],
      webhook_status: ["active", "paused", "failing"],
    },
  },
} as const

