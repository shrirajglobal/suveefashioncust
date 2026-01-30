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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          created_at: string
          created_by: string | null
          dnd: boolean
          id: string
          is_critical: boolean
          last_contacted_date: string | null
          mobile_no: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          dnd?: boolean
          id?: string
          is_critical?: boolean
          last_contacted_date?: string | null
          mobile_no: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          dnd?: boolean
          id?: string
          is_critical?: boolean
          last_contacted_date?: string | null
          mobile_no?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      interactions: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          interaction_datetime: string
          interaction_outcome: Database["public"]["Enums"]["interaction_outcome"]
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          next_followup_date: string | null
          notes: string
          salesperson_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          interaction_datetime?: string
          interaction_outcome: Database["public"]["Enums"]["interaction_outcome"]
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          next_followup_date?: string | null
          notes: string
          salesperson_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          interaction_datetime?: string
          interaction_outcome?: Database["public"]["Enums"]["interaction_outcome"]
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          next_followup_date?: string | null
          notes?: string
          salesperson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_analytics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_restricted: boolean
          mobile_no: string | null
          restricted_until: string | null
          restriction_reason: string | null
          salary: number | null
          sales_target: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_restricted?: boolean
          mobile_no?: string | null
          restricted_until?: string | null
          restriction_reason?: string | null
          salary?: number | null
          sales_target?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_restricted?: boolean
          mobile_no?: string | null
          restricted_until?: string | null
          restriction_reason?: string | null
          salary?: number | null
          sales_target?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          id: string
          transaction_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          id?: string
          transaction_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_analytics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          user_id?: string
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
      whatsapp_templates: {
        Row: {
          id: string
          message_template: string
          segment_key: string
          segment_label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          message_template: string
          segment_key: string
          segment_label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          message_template?: string
          segment_key?: string
          segment_label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      customer_analytics: {
        Row: {
          assigned_salesperson_id: string | null
          assigned_salesperson_name: string | null
          city: string | null
          created_at: string | null
          customer_id: string | null
          days_since_last_contact: number | null
          days_since_last_order: number | null
          dnd: boolean | null
          last_contacted_date: string | null
          last_order_date: string | null
          name: string | null
          phone: string | null
          priority_score: number | null
          total_lifetime_sales: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_accounts: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "accounts" | "sales_team"
      interaction_outcome:
        | "successful"
        | "no_answer"
        | "callback_requested"
        | "not_interested"
        | "order_placed"
        | "follow_up_needed"
        | "other"
      interaction_type:
        | "phone_call"
        | "whatsapp"
        | "email"
        | "in_person"
        | "sms"
        | "other"
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
      app_role: ["super_admin", "accounts", "sales_team"],
      interaction_outcome: [
        "successful",
        "no_answer",
        "callback_requested",
        "not_interested",
        "order_placed",
        "follow_up_needed",
        "other",
      ],
      interaction_type: [
        "phone_call",
        "whatsapp",
        "email",
        "in_person",
        "sms",
        "other",
      ],
    },
  },
} as const
