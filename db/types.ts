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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
      areas: {
        Row: {
          created_at: string
          description: string | null
          geo: Json | null
          hero_image_id: string | null
          id: string
          kind: Database["public"]["Enums"]["area_kind"]
          name: string
          parent_id: string | null
          seo_meta: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          geo?: Json | null
          hero_image_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["area_kind"]
          name: string
          parent_id?: string | null
          seo_meta?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          geo?: Json | null
          hero_image_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["area_kind"]
          name?: string
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
      articles: {
        Row: {
          author_id: string | null
          body_html: string
          category: Database["public"]["Enums"]["article_category"]
          created_at: string
          deleted_at: string | null
          excerpt: string | null
          hero_image_id: string | null
          id: string
          published_at: string | null
          read_minutes: number | null
          scheduled_for: string | null
          seo: Json | null
          slug: string
          status: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_html?: string
          category?: Database["public"]["Enums"]["article_category"]
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          hero_image_id?: string | null
          id?: string
          published_at?: string | null
          read_minutes?: number | null
          scheduled_for?: string | null
          seo?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_html?: string
          category?: Database["public"]["Enums"]["article_category"]
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          hero_image_id?: string | null
          id?: string
          published_at?: string | null
          read_minutes?: number | null
          scheduled_for?: string | null
          seo?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["article_status"]
          title?: string
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
      developers: {
        Row: {
          created_at: string
          description: string | null
          founded_year: number | null
          id: string
          logo_id: string | null
          name: string
          slug: string
          stats: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          founded_year?: number | null
          id?: string
          logo_id?: string | null
          name: string
          slug: string
          stats?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          founded_year?: number | null
          id?: string
          logo_id?: string | null
          name?: string
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
      development_units: {
        Row: {
          beds: number | null
          built_up_ft2: number | null
          created_at: string
          development_id: string
          floor_plan_id: string | null
          id: string
          lagoon_access: string | null
          orientation: string | null
          plot_ft2: number | null
          plot_number: string | null
          price_aed: number | null
          sort_order: number
          status: Database["public"]["Enums"]["development_unit_status"]
          unit_type: string
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
          orientation?: string | null
          plot_ft2?: number | null
          plot_number?: string | null
          price_aed?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["development_unit_status"]
          unit_type: string
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
          orientation?: string | null
          plot_ft2?: number | null
          plot_number?: string | null
          price_aed?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["development_unit_status"]
          unit_type?: string
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
          area_id: string | null
          bedrooms_text: string | null
          brochure_id: string | null
          created_at: string
          description: string | null
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
          payment_plan: Json | null
          published_at: string | null
          seo: Json | null
          slug: string
          starting_price: number | null
          status: Database["public"]["Enums"]["development_status"]
          tagline: string | null
          total_units: number | null
          updated_at: string
          vision: string | null
        }
        Insert: {
          amenities?: string[]
          area_id?: string | null
          bedrooms_text?: string | null
          brochure_id?: string | null
          created_at?: string
          description?: string | null
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
          payment_plan?: Json | null
          published_at?: string | null
          seo?: Json | null
          slug: string
          starting_price?: number | null
          status?: Database["public"]["Enums"]["development_status"]
          tagline?: string | null
          total_units?: number | null
          updated_at?: string
          vision?: string | null
        }
        Update: {
          amenities?: string[]
          area_id?: string | null
          bedrooms_text?: string | null
          brochure_id?: string | null
          created_at?: string
          description?: string | null
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
          payment_plan?: Json | null
          published_at?: string | null
          seo?: Json | null
          slug?: string
          starting_price?: number | null
          status?: Database["public"]["Enums"]["development_status"]
          tagline?: string | null
          total_units?: number | null
          updated_at?: string
          vision?: string | null
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
      enquiries: {
        Row: {
          account_id: string | null
          assigned_agent_id: string | null
          brief_raw: string | null
          budget_max: number | null
          budget_min: number | null
          close_reason: string | null
          closed_at: string | null
          created_at: string
          development_id: string | null
          email: string | null
          first_response_at: string | null
          id: string
          inferred_constraints: Json | null
          internal_notes: string | null
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
          assigned_agent_id?: string | null
          brief_raw?: string | null
          budget_max?: number | null
          budget_min?: number | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          development_id?: string | null
          email?: string | null
          first_response_at?: string | null
          id?: string
          inferred_constraints?: Json | null
          internal_notes?: string | null
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
          assigned_agent_id?: string | null
          brief_raw?: string | null
          budget_max?: number | null
          budget_min?: number | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          development_id?: string | null
          email?: string | null
          first_response_at?: string | null
          id?: string
          inferred_constraints?: Json | null
          internal_notes?: string | null
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
      floor_plans: {
        Row: {
          area_ft2: number | null
          beds: number | null
          created_at: string
          development_id: string
          id: string
          label: string
          media_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          area_ft2?: number | null
          beds?: number | null
          created_at?: string
          development_id: string
          id?: string
          label: string
          media_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area_ft2?: number | null
          beds?: number | null
          created_at?: string
          development_id?: string
          id?: string
          label?: string
          media_id?: string | null
          sort_order?: number
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
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          created_at: string
          deleted_at: string | null
          filename: string
          folder: Database["public"]["Enums"]["media_folder"]
          height: number | null
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
          created_at?: string
          deleted_at?: string | null
          filename: string
          folder?: Database["public"]["Enums"]["media_folder"]
          height?: number | null
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
          created_at?: string
          deleted_at?: string | null
          filename?: string
          folder?: Database["public"]["Enums"]["media_folder"]
          height?: number | null
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
      newsletter_subscribers: {
        Row: {
          account_id: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
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
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_line: string | null
          amenities: string[]
          area_id: string | null
          assigned_agent_id: string | null
          baths: number
          beds: number
          building_id: string | null
          built_up_ft2: number | null
          compliance: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          development_id: string | null
          dld_plot_number: string | null
          enquiry_count: number
          flags: Json
          floor: number | null
          furnishing: Database["public"]["Enums"]["property_furnishing"] | null
          geo: Json | null
          id: string
          listing_permit_expires_at: string | null
          listing_permit_no: string | null
          mode: Database["public"]["Enums"]["property_mode"]
          orientation: string | null
          parking_bays: number | null
          plot_ft2: number | null
          price_aed: number
          price_history: Json
          published_at: string | null
          reference: string
          search_text: unknown
          seo: Json | null
          service_charge_per_ft2: number | null
          short_description: string | null
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          sub_community_id: string | null
          tenure: Database["public"]["Enums"]["property_tenure"] | null
          title: string
          type: Database["public"]["Enums"]["property_type"]
          unit_number: string | null
          updated_at: string
          view: string | null
          view_count: number
          year_built: number | null
        }
        Insert: {
          address_line?: string | null
          amenities?: string[]
          area_id?: string | null
          assigned_agent_id?: string | null
          baths?: number
          beds?: number
          building_id?: string | null
          built_up_ft2?: number | null
          compliance?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          development_id?: string | null
          dld_plot_number?: string | null
          enquiry_count?: number
          flags?: Json
          floor?: number | null
          furnishing?: Database["public"]["Enums"]["property_furnishing"] | null
          geo?: Json | null
          id?: string
          listing_permit_expires_at?: string | null
          listing_permit_no?: string | null
          mode: Database["public"]["Enums"]["property_mode"]
          orientation?: string | null
          parking_bays?: number | null
          plot_ft2?: number | null
          price_aed: number
          price_history?: Json
          published_at?: string | null
          reference: string
          search_text?: unknown
          seo?: Json | null
          service_charge_per_ft2?: number | null
          short_description?: string | null
          slug: string
          status?: Database["public"]["Enums"]["property_status"]
          sub_community_id?: string | null
          tenure?: Database["public"]["Enums"]["property_tenure"] | null
          title: string
          type: Database["public"]["Enums"]["property_type"]
          unit_number?: string | null
          updated_at?: string
          view?: string | null
          view_count?: number
          year_built?: number | null
        }
        Update: {
          address_line?: string | null
          amenities?: string[]
          area_id?: string | null
          assigned_agent_id?: string | null
          baths?: number
          beds?: number
          building_id?: string | null
          built_up_ft2?: number | null
          compliance?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          development_id?: string | null
          dld_plot_number?: string | null
          enquiry_count?: number
          flags?: Json
          floor?: number | null
          furnishing?: Database["public"]["Enums"]["property_furnishing"] | null
          geo?: Json | null
          id?: string
          listing_permit_expires_at?: string | null
          listing_permit_no?: string | null
          mode?: Database["public"]["Enums"]["property_mode"]
          orientation?: string | null
          parking_bays?: number | null
          plot_ft2?: number | null
          price_aed?: number
          price_history?: Json
          published_at?: string | null
          reference?: string
          search_text?: unknown
          seo?: Json | null
          service_charge_per_ft2?: number | null
          short_description?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["property_status"]
          sub_community_id?: string | null
          tenure?: Database["public"]["Enums"]["property_tenure"] | null
          title?: string
          type?: Database["public"]["Enums"]["property_type"]
          unit_number?: string | null
          updated_at?: string
          view?: string | null
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
          property_id: string
          source_text: string | null
        }
        Insert: {
          embedded_at?: string | null
          embedding?: string | null
          property_id: string
          source_text?: string | null
        }
        Update: {
          embedded_at?: string | null
          embedding?: string | null
          property_id?: string
          source_text?: string | null
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
      saved_properties: {
        Row: {
          created_at: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          alert_frequency: Database["public"]["Enums"]["alert_frequency"]
          created_at: string
          id: string
          last_alert_at: string | null
          mode: Database["public"]["Enums"]["property_mode"] | null
          name: string
          query: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_frequency?: Database["public"]["Enums"]["alert_frequency"]
          created_at?: string
          id?: string
          last_alert_at?: string | null
          mode?: Database["public"]["Enums"]["property_mode"] | null
          name: string
          query: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_frequency?: Database["public"]["Enums"]["alert_frequency"]
          created_at?: string
          id?: string
          last_alert_at?: string | null
          mode?: Database["public"]["Enums"]["property_mode"] | null
          name?: string
          query?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          bio: string | null
          brn: string | null
          created_at: string
          credentials: string[]
          display_name: string
          joined_at: string | null
          languages: Json
          photo_url: string | null
          role: Database["public"]["Enums"]["staff_role"]
          slug: string
          specialties: string[]
          status: Database["public"]["Enums"]["staff_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          brn?: string | null
          created_at?: string
          credentials?: string[]
          display_name: string
          joined_at?: string | null
          languages?: Json
          photo_url?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          slug: string
          specialties?: string[]
          status?: Database["public"]["Enums"]["staff_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          brn?: string | null
          created_at?: string
          credentials?: string[]
          display_name?: string
          joined_at?: string | null
          languages?: Json
          photo_url?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          slug?: string
          specialties?: string[]
          status?: Database["public"]["Enums"]["staff_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      account_kyc_status: "unverified" | "pending" | "verified" | "rejected"
      account_language: "en" | "ar"
      account_residency_status: "uae_resident" | "non_resident" | "gcc_national"
      alert_frequency: "off" | "instant" | "daily" | "weekly"
      area_kind: "emirate" | "area" | "sub_community" | "building"
      article_category:
        | "market_report"
        | "buyers_guide"
        | "sellers_guide"
        | "field_note"
        | "policy"
        | "off_plan_watch"
      article_status: "draft" | "scheduled" | "published" | "archived"
      audit_actor_kind: "user" | "system" | "integration"
      concierge_message_role: "user" | "assistant" | "system"
      development_media_role:
        | "hero"
        | "gallery"
        | "render"
        | "masterplan"
        | "brochure"
        | "video"
      development_status: "pre_launch" | "on_sale" | "sold_out" | "handed_over"
      development_unit_status: "available" | "held" | "reserved" | "sold"
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
      media_folder: "listings" | "brand" | "blog" | "team" | "documents"
      message_author_kind: "lead" | "staff" | "system" | "ai"
      message_channel: "web" | "email" | "whatsapp" | "sms"
      message_direction: "inbound" | "outbound"
      newsletter_status: "pending" | "confirmed" | "unsubscribed" | "bounced"
      page_status: "draft" | "published"
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
      review_status: "pending" | "approved" | "rejected"
      review_subject_kind: "agent" | "area" | "development"
      staff_role: "admin" | "editor" | "agent" | "marketing" | "support"
      staff_status: "active" | "on_leave" | "onboarding" | "suspended"
      viewing_status:
        | "tentative"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
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
      area_kind: ["emirate", "area", "sub_community", "building"],
      article_category: [
        "market_report",
        "buyers_guide",
        "sellers_guide",
        "field_note",
        "policy",
        "off_plan_watch",
      ],
      article_status: ["draft", "scheduled", "published", "archived"],
      audit_actor_kind: ["user", "system", "integration"],
      concierge_message_role: ["user", "assistant", "system"],
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
      media_folder: ["listings", "brand", "blog", "team", "documents"],
      message_author_kind: ["lead", "staff", "system", "ai"],
      message_channel: ["web", "email", "whatsapp", "sms"],
      message_direction: ["inbound", "outbound"],
      newsletter_status: ["pending", "confirmed", "unsubscribed", "bounced"],
      page_status: ["draft", "published"],
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
      ],
      review_status: ["pending", "approved", "rejected"],
      review_subject_kind: ["agent", "area", "development"],
      staff_role: ["admin", "editor", "agent", "marketing", "support"],
      staff_status: ["active", "on_leave", "onboarding", "suspended"],
      viewing_status: [
        "tentative",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
    },
  },
} as const

