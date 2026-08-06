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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          summary?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          summary?: string
        }
        Relationships: []
      }
      admin_preferences: {
        Row: {
          created_at: string
          favourites: string[]
          page_size: number
          recent_products: string[]
          saved_filters: Json
          updated_at: string
          user_id: string
          visible_columns: string[]
        }
        Insert: {
          created_at?: string
          favourites?: string[]
          page_size?: number
          recent_products?: string[]
          saved_filters?: Json
          updated_at?: string
          user_id: string
          visible_columns?: string[]
        }
        Update: {
          created_at?: string
          favourites?: string[]
          page_size?: number
          recent_products?: string[]
          saved_filters?: Json
          updated_at?: string
          user_id?: string
          visible_columns?: string[]
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          email: string
          email_error: string | null
          email_status: string
          id: string
          ip: string | null
          message: string
          name: string
          phone: string | null
          user_agent: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          email: string
          email_error?: string | null
          email_status?: string
          id?: string
          ip?: string | null
          message: string
          name: string
          phone?: string | null
          user_agent?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          email?: string
          email_error?: string | null
          email_status?: string
          id?: string
          ip?: string | null
          message?: string
          name?: string
          phone?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      product_revisions: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          changed_fields: string[]
          created_at: string
          id: string
          product_id: string
          product_slug: string
          snapshot: Json
        }
        Insert: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          changed_fields?: string[]
          created_at?: string
          id?: string
          product_id: string
          product_slug: string
          snapshot: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          changed_fields?: string[]
          created_at?: string
          id?: string
          product_id?: string
          product_slug?: string
          snapshot?: Json
        }
        Relationships: []
      }
      products: {
        Row: {
          backorders: boolean
          barcode: string
          brand: string
          categories: string[]
          collection: string
          cost_price: number | null
          created_at: string
          description: string
          id: string
          image_alts: string[]
          images: string[]
          location: string
          name: string
          price: number
          published_at: string | null
          reorder_level: number
          sale_price: number | null
          seo_description: string
          seo_title: string
          sku: string
          slug: string
          status: string
          stock: number
          supplier: string
          tags: string[]
          total_stock: number
          track_inventory: boolean
          updated_at: string
          variants: Json
          weight_kg: number
        }
        Insert: {
          backorders?: boolean
          barcode?: string
          brand?: string
          categories?: string[]
          collection?: string
          cost_price?: number | null
          created_at?: string
          description?: string
          id?: string
          image_alts?: string[]
          images?: string[]
          location?: string
          name: string
          price?: number
          published_at?: string | null
          reorder_level?: number
          sale_price?: number | null
          seo_description?: string
          seo_title?: string
          sku?: string
          slug: string
          status?: string
          stock?: number
          supplier?: string
          tags?: string[]
          total_stock?: number
          track_inventory?: boolean
          updated_at?: string
          variants?: Json
          weight_kg?: number
        }
        Update: {
          backorders?: boolean
          barcode?: string
          brand?: string
          categories?: string[]
          collection?: string
          cost_price?: number | null
          created_at?: string
          description?: string
          id?: string
          image_alts?: string[]
          images?: string[]
          location?: string
          name?: string
          price?: number
          published_at?: string | null
          reorder_level?: number
          sale_price?: number | null
          seo_description?: string
          seo_title?: string
          sku?: string
          slug?: string
          status?: string
          stock?: number
          supplier?: string
          tags?: string[]
          total_stock?: number
          track_inventory?: boolean
          updated_at?: string
          variants?: Json
          weight_kg?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restock_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          product_name: string
          product_slug: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          product_name: string
          product_slug: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          product_name?: string
          product_slug?: string
        }
        Relationships: []
      }
      shipping_carriers: {
        Row: {
          code: string
          created_at: string
          currency: string
          free_shipping_threshold: number | null
          id: string
          is_active: boolean
          is_default: boolean
          max_weight_kg: number
          name: string
          origin_country: string
          round_weight: boolean
          settings: Json
          sort_order: number
          updated_at: string
          weight_interval_kg: number
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          max_weight_kg?: number
          name: string
          origin_country?: string
          round_weight?: boolean
          settings?: Json
          sort_order?: number
          updated_at?: string
          weight_interval_kg?: number
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          max_weight_kg?: number
          name?: string
          origin_country?: string
          round_weight?: boolean
          settings?: Json
          sort_order?: number
          updated_at?: string
          weight_interval_kg?: number
        }
        Relationships: []
      }
      shipping_country_rules: {
        Row: {
          carrier_id: string
          country: string
          country_code: string | null
          created_at: string
          id: string
          rate_group_id: string | null
          status: Database["public"]["Enums"]["shipping_service_status"]
          updated_at: string
        }
        Insert: {
          carrier_id: string
          country: string
          country_code?: string | null
          created_at?: string
          id?: string
          rate_group_id?: string | null
          status?: Database["public"]["Enums"]["shipping_service_status"]
          updated_at?: string
        }
        Update: {
          carrier_id?: string
          country?: string
          country_code?: string | null
          created_at?: string
          id?: string
          rate_group_id?: string | null
          status?: Database["public"]["Enums"]["shipping_service_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_country_rules_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_country_rules_rate_group_id_fkey"
            columns: ["rate_group_id"]
            isOneToOne: false
            referencedRelation: "shipping_rate_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_import_batches: {
        Row: {
          carrier_id: string | null
          created_at: string
          file_name: string | null
          id: string
          kind: string
          rolled_back_at: string | null
          rows_created: number
          rows_skipped: number
          rows_total: number
          rows_updated: number
          snapshot: Json
          user_id: string | null
          user_label: string | null
          warnings: Json
        }
        Insert: {
          carrier_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          kind: string
          rolled_back_at?: string | null
          rows_created?: number
          rows_skipped?: number
          rows_total?: number
          rows_updated?: number
          snapshot?: Json
          user_id?: string | null
          user_label?: string | null
          warnings?: Json
        }
        Update: {
          carrier_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: string
          rolled_back_at?: string | null
          rows_created?: number
          rows_skipped?: number
          rows_total?: number
          rows_updated?: number
          snapshot?: Json
          user_id?: string | null
          user_label?: string | null
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "shipping_import_batches_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_messages: {
        Row: {
          body_html: string
          carrier_id: string | null
          created_at: string
          id: string
          locale: string
          status: Database["public"]["Enums"]["shipping_service_status"]
          updated_at: string
        }
        Insert: {
          body_html?: string
          carrier_id?: string | null
          created_at?: string
          id?: string
          locale?: string
          status: Database["public"]["Enums"]["shipping_service_status"]
          updated_at?: string
        }
        Update: {
          body_html?: string
          carrier_id?: string | null
          created_at?: string
          id?: string
          locale?: string
          status?: Database["public"]["Enums"]["shipping_service_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_messages_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rate_groups: {
        Row: {
          carrier_id: string
          code: string
          created_at: string
          id: string
          label: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          carrier_id: string
          code: string
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          carrier_id?: string
          code?: string
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rate_groups_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rate_tiers: {
        Row: {
          created_at: string
          id: string
          max_weight_kg: number
          price: number
          rate_group_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_weight_kg: number
          price: number
          rate_group_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_weight_kg?: number
          price?: number
          rate_group_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rate_tiers_rate_group_id_fkey"
            columns: ["rate_group_id"]
            isOneToOne: false
            referencedRelation: "shipping_rate_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_surcharges: {
        Row: {
          amount: number
          calc: Database["public"]["Enums"]["shipping_surcharge_calc"]
          carrier_id: string
          country: string | null
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["shipping_surcharge_kind"]
          label: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          calc?: Database["public"]["Enums"]["shipping_surcharge_calc"]
          carrier_id: string
          country?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["shipping_surcharge_kind"]
          label: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          calc?: Database["public"]["Enums"]["shipping_surcharge_calc"]
          carrier_id?: string
          country?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["shipping_surcharge_kind"]
          label?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_surcharges_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "user"
      shipping_service_status: "rated" | "no_rate" | "no_service"
      shipping_surcharge_calc: "percent" | "fixed"
      shipping_surcharge_kind: "fuel" | "remote_area" | "peak_season" | "custom"
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
      app_role: ["admin", "user"],
      shipping_service_status: ["rated", "no_rate", "no_service"],
      shipping_surcharge_calc: ["percent", "fixed"],
      shipping_surcharge_kind: ["fuel", "remote_area", "peak_season", "custom"],
    },
  },
} as const
