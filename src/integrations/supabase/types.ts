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
      attendance_flags: {
        Row: {
          created_at: string
          date: string
          description: string | null
          employee_id: string
          flag_id: string
          flag_type: string
          is_resolved: boolean
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          employee_id: string
          flag_id?: string
          flag_type: string
          is_resolved?: boolean
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          employee_id?: string
          flag_id?: string
          flag_type?: string
          is_resolved?: boolean
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_flags_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "attendance_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          created_at: string
          date: string
          device_id: string | null
          employee_id: string
          entry_status: Database["public"]["Enums"]["entry_status"]
          gps_latitude: number | null
          gps_longitude: number | null
          log_id: string
          punch_time: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          selfie_image_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          device_id?: string | null
          employee_id: string
          entry_status?: Database["public"]["Enums"]["entry_status"]
          gps_latitude?: number | null
          gps_longitude?: number | null
          log_id?: string
          punch_time?: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          selfie_image_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string | null
          employee_id?: string
          entry_status?: Database["public"]["Enums"]["entry_status"]
          gps_latitude?: number | null
          gps_longitude?: number | null
          log_id?: string
          punch_time?: string
          punch_type?: Database["public"]["Enums"]["punch_type"]
          selfie_image_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      attendance_review: {
        Row: {
          action: Database["public"]["Enums"]["review_action"]
          created_at: string
          edited_time: string | null
          log_id: string
          manager_id: string
          reason: string | null
          review_id: string
          reviewed_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["review_action"]
          created_at?: string
          edited_time?: string | null
          log_id: string
          manager_id: string
          reason?: string | null
          review_id?: string
          reviewed_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["review_action"]
          created_at?: string
          edited_time?: string | null
          log_id?: string
          manager_id?: string
          reason?: string | null
          review_id?: string
          reviewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_review_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["log_id"]
          },
          {
            foreignKeyName: "attendance_review_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
        ]
      }
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
      employee_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          employee_id: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          employee_id: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          employee_id?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_locations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      employee_master: {
        Row: {
          base_salary: number
          created_at: string
          department: string
          employee_id: string
          full_name: string
          joining_date: string
          overtime_rate: number
          per_day_rate: number
          reporting_manager_id: string | null
          role: string
          salary_type: Database["public"]["Enums"]["salary_type"]
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          base_salary?: number
          created_at?: string
          department: string
          employee_id?: string
          full_name: string
          joining_date?: string
          overtime_rate?: number
          per_day_rate?: number
          reporting_manager_id?: string | null
          role: string
          salary_type?: Database["public"]["Enums"]["salary_type"]
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          base_salary?: number
          created_at?: string
          department?: string
          employee_id?: string
          full_name?: string
          joining_date?: string
          overtime_rate?: number
          per_day_rate?: number
          reporting_manager_id?: string | null
          role?: string
          salary_type?: Database["public"]["Enums"]["salary_type"]
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_master_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
        ]
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
      location_tracking_settings: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_enabled: boolean
          tracking_end_time: string
          tracking_start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_enabled?: boolean
          tracking_end_time?: string
          tracking_start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_enabled?: boolean
          tracking_end_time?: string
          tracking_start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_tracking_settings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      monthly_payroll: {
        Row: {
          absent_days: number
          created_at: string
          days_present: number
          deduction_rate: number
          employee_id: string
          gross_salary: number | null
          is_locked: boolean
          leave_days: number
          locked_at: string | null
          locked_by: string | null
          month_year: string
          net_salary: number | null
          overtime_hours: number
          overtime_rate: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          payroll_id: string
          payslip_url: string | null
          per_day_rate: number
          total_deductions: number | null
          total_working_days: number
          updated_at: string
        }
        Insert: {
          absent_days?: number
          created_at?: string
          days_present?: number
          deduction_rate?: number
          employee_id: string
          gross_salary?: number | null
          is_locked?: boolean
          leave_days?: number
          locked_at?: string | null
          locked_by?: string | null
          month_year: string
          net_salary?: number | null
          overtime_hours?: number
          overtime_rate?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payroll_id?: string
          payslip_url?: string | null
          per_day_rate?: number
          total_deductions?: number | null
          total_working_days?: number
          updated_at?: string
        }
        Update: {
          absent_days?: number
          created_at?: string
          days_present?: number
          deduction_rate?: number
          employee_id?: string
          gross_salary?: number | null
          is_locked?: boolean
          leave_days?: number
          locked_at?: string | null
          locked_by?: string | null
          month_year?: string
          net_salary?: number | null
          overtime_hours?: number
          overtime_rate?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payroll_id?: string
          payslip_url?: string | null
          per_day_rate?: number
          total_deductions?: number | null
          total_working_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      paid_holidays: {
        Row: {
          created_at: string
          created_by: string | null
          financial_year: string
          holiday_date: string
          holiday_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          financial_year: string
          holiday_date: string
          holiday_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          financial_year?: string
          holiday_date?: string
          holiday_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salary_rules: {
        Row: {
          created_at: string
          deduction_per_absent_day: number
          employee_id: string
          overtime_multiplier: number
          paid_leaves_allowed: number
          rule_id: string
          updated_at: string
          working_days_per_month: number
        }
        Insert: {
          created_at?: string
          deduction_per_absent_day?: number
          employee_id: string
          overtime_multiplier?: number
          paid_leaves_allowed?: number
          rule_id?: string
          updated_at?: string
          working_days_per_month?: number
        }
        Update: {
          created_at?: string
          deduction_per_absent_day?: number
          employee_id?: string
          overtime_multiplier?: number
          paid_leaves_allowed?: number
          rule_id?: string
          updated_at?: string
          working_days_per_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_rules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      staff_payments: {
        Row: {
          amount_paid: number
          created_at: string
          employee_id: string
          payment_date: string
          payment_id: string
          payment_mode: Database["public"]["Enums"]["staff_payment_mode"]
          payroll_id: string
          recorded_by: string
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          employee_id: string
          payment_date?: string
          payment_id?: string
          payment_mode: Database["public"]["Enums"]["staff_payment_mode"]
          payroll_id: string
          recorded_by: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          employee_id?: string
          payment_date?: string
          payment_id?: string
          payment_mode?: Database["public"]["Enums"]["staff_payment_mode"]
          payroll_id?: string
          recorded_by?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "staff_payments_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "monthly_payroll"
            referencedColumns: ["payroll_id"]
          },
        ]
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
      work_shifts: {
        Row: {
          break_duration_minutes: number
          created_at: string
          end_time: string
          id: string
          is_default: boolean
          shift_name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          break_duration_minutes?: number
          created_at?: string
          end_time: string
          id?: string
          is_default?: boolean
          shift_name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          break_duration_minutes?: number
          created_at?: string
          end_time?: string
          id?: string
          is_default?: boolean
          shift_name?: string
          start_time?: string
          updated_at?: string
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
      get_employee_id: { Args: { _user_id: string }; Returns: string }
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
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_team_member: {
        Args: { _employee_id: string; _manager_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "accounts" | "sales_team" | "manager" | "staff"
      employee_status: "active" | "inactive"
      entry_status: "auto" | "edited"
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
      payment_status: "pending" | "paid"
      punch_type: "IN" | "OUT"
      review_action: "approved" | "edited" | "rejected"
      salary_type: "monthly" | "daily" | "hourly"
      staff_payment_mode: "UPI" | "Bank" | "Cash"
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
      app_role: ["super_admin", "accounts", "sales_team", "manager", "staff"],
      employee_status: ["active", "inactive"],
      entry_status: ["auto", "edited"],
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
      payment_status: ["pending", "paid"],
      punch_type: ["IN", "OUT"],
      review_action: ["approved", "edited", "rejected"],
      salary_type: ["monthly", "daily", "hourly"],
      staff_payment_mode: ["UPI", "Bank", "Cash"],
    },
  },
} as const
