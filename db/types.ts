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
      developments: {
        Row: {
          amenities: string[]
          area_id: string | null
          brochure_id: string | null
          created_at: string
          description: string | null
          developer_id: string
          escrow_account: string | null
          handover_date: string | null
          id: string
          lead_advisor_id: string | null
          masterplan_id: string | null
          meta: Json | null
          name: string
          payment_plan: Json | null
          slug: string
          starting_price: number | null
          status: Database["public"]["Enums"]["development_status"]
          total_units: number | null
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          area_id?: string | null
          brochure_id?: string | null
          created_at?: string
          description?: string | null
          developer_id: string
          escrow_account?: string | null
          handover_date?: string | null
          id?: string
          lead_advisor_id?: string | null
          masterplan_id?: string | null
          meta?: Json | null
          name: string
          payment_plan?: Json | null
          slug: string
          starting_price?: number | null
          status?: Database["public"]["Enums"]["development_status"]
          total_units?: number | null
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          area_id?: string | null
          brochure_id?: string | null
          created_at?: string
          description?: string | null
          developer_id?: string
          escrow_account?: string | null
          handover_date?: string | null
          id?: string
          lead_advisor_id?: string | null
          masterplan_id?: string | null
          meta?: Json | null
          name?: string
          payment_plan?: Json | null
          slug?: string
          starting_price?: number | null
          status?: Database["public"]["Enums"]["development_status"]
          total_units?: number | null
          updated_at?: string
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
      area_kind: "emirate" | "area" | "sub_community" | "building"
      audit_actor_kind: "user" | "system" | "integration"
      development_status: "pre_launch" | "on_sale" | "sold_out" | "handed_over"
      media_folder: "listings" | "brand" | "blog" | "team" | "documents"
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
      staff_role: "admin" | "editor" | "agent" | "marketing" | "support"
      staff_status: "active" | "on_leave" | "onboarding" | "suspended"
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
      area_kind: ["emirate", "area", "sub_community", "building"],
      audit_actor_kind: ["user", "system", "integration"],
      development_status: ["pre_launch", "on_sale", "sold_out", "handed_over"],
      media_folder: ["listings", "brand", "blog", "team", "documents"],
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
      staff_role: ["admin", "editor", "agent", "marketing", "support"],
      staff_status: ["active", "on_leave", "onboarding", "suspended"],
    },
  },
} as const

