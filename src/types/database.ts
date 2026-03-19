// AUTO-GENERATED — do not edit manually.
// Regenerate with: Supabase MCP → generate_typescript_types (project: eqivgxdffsfjbdyikktt)

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      account_sections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      asana_connections: {
        Row: {
          access_token_enc: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token_enc: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
          workspace_name: string | null
        }
        Insert: {
          access_token_enc: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token_enc?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Update: {
          access_token_enc?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token_enc?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          last_updated: string
          name: string
          position: number
          section_id: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          last_updated?: string
          name: string
          position?: number
          section_id?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          last_updated?: string
          name?: string
          position?: number
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "account_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      business_engagements: {
        Row: {
          id: string
          user_id: string
          client: string
          description: string | null
          date: string
          amount: number
          tax_rate: number
          taxes_owed: number | null
          revenue: number | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client: string
          description?: string | null
          date: string
          amount?: number
          tax_rate?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client?: string
          description?: string | null
          date?: string
          amount?: number
          tax_rate?: number
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      budget_sections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          month: number
          monthly_limit: number
          position: number
          section_id: string | null
          year: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          month: number
          monthly_limit: number
          position?: number
          section_id?: string | null
          year: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          month?: number
          monthly_limit?: number
          position?: number
          section_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "budget_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          description: string | null
          end_at: string | null
          id: string
          source: string
          source_id: string | null
          start_at: string
          title: string
          user_id: string | null
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          source?: string
          source_id?: string | null
          start_at: string
          title: string
          user_id?: string | null
        }
        Update: {
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          source?: string
          source_id?: string | null
          start_at?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          messages: Json
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cleaning_duties: {
        Row: {
          assigned_to: string | null
          created_at: string
          frequency: string
          id: string
          last_completed: string | null
          name: string
          next_due: string | null
          notes: string | null
          position: number
          room: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          frequency: string
          id?: string
          last_completed?: string | null
          name: string
          next_due?: string | null
          notes?: string | null
          position?: number
          room?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          frequency?: string
          id?: string
          last_completed?: string | null
          name?: string
          next_due?: string | null
          notes?: string | null
          position?: number
          room?: string | null
        }
        Relationships: []
      }
      debt_sections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          balance: number
          created_at: string
          id: string
          interest_rate: number | null
          min_payment: number | null
          name: string
          notes: string | null
          payoff_date: string | null
          position: number
          section_id: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          interest_rate?: number | null
          min_payment?: number | null
          name: string
          notes?: string | null
          payoff_date?: string | null
          position?: number
          section_id?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          interest_rate?: number | null
          min_payment?: number | null
          name?: string
          notes?: string | null
          payoff_date?: string | null
          position?: number
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "debt_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_sections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          access_token_enc: string
          email: string | null
          expires_at: string
          refresh_token_enc: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token_enc: string
          email?: string | null
          expires_at: string
          refresh_token_enc: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token_enc?: string
          email?: string | null
          expires_at?: string
          refresh_token_enc?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_connections: {
        Row: {
          access_token_enc: string
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          refresh_token_enc: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          refresh_token_enc?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          refresh_token_enc?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grocery_items: {
        Row: {
          category: string | null
          checked: boolean
          created_at: string
          expiry_date: string | null
          id: string
          in_pantry: boolean
          low_threshold: number | null
          name: string
          position: number
          quantity: number
          unit: string | null
        }
        Insert: {
          category?: string | null
          checked?: boolean
          created_at?: string
          expiry_date?: string | null
          id?: string
          in_pantry?: boolean
          low_threshold?: number | null
          name: string
          position?: number
          quantity?: number
          unit?: string | null
        }
        Update: {
          category?: string | null
          checked?: boolean
          created_at?: string
          expiry_date?: string | null
          id?: string
          in_pantry?: boolean
          low_threshold?: number | null
          name?: string
          position?: number
          quantity?: number
          unit?: string | null
        }
        Relationships: []
      }
      income_sources: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          frequency: string
          id: string
          name: string
          next_date: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          amount: number
          created_at?: string
          frequency: string
          id?: string
          name: string
          next_date?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          frequency?: string
          id?: string
          name?: string
          next_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      insurance_policies: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          premium: number | null
          provider: string | null
          renewal_date: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          premium?: number | null
          provider?: string | null
          renewal_date?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          premium?: number | null
          provider?: string | null
          renewal_date?: string | null
          type?: string
        }
        Relationships: []
      }
      investment_sections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          account_number: string | null
          account_type: string
          as_of_date: string | null
          balance: number
          cost_basis: number | null
          created_at: string | null
          gain_loss: number | null
          id: string
          institution: string | null
          name: string
          notes: string | null
          position: number
          rate_of_return: number | null
          section_id: string | null
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          as_of_date?: string | null
          balance?: number
          cost_basis?: number | null
          created_at?: string | null
          gain_loss?: number | null
          id?: string
          institution?: string | null
          name: string
          notes?: string | null
          position?: number
          rate_of_return?: number | null
          section_id?: string | null
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          as_of_date?: string | null
          balance?: number
          cost_basis?: number | null
          created_at?: string | null
          gain_loss?: number | null
          id?: string
          institution?: string | null
          name?: string
          notes?: string | null
          position?: number
          rate_of_return?: number | null
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "investment_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_log: {
        Row: {
          action: string
          date: string
          id: string
          item_id: string
          note: string | null
          quantity: number
          user_id: string
        }
        Insert: {
          action: string
          date?: string
          id?: string
          item_id: string
          note?: string | null
          quantity: number
          user_id: string
        }
        Update: {
          action?: string
          date?: string
          id?: string
          item_id?: string
          note?: string | null
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "grocery_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          account_id: string | null
          active: boolean
          amount: number
          auto_pay: boolean
          billing_day: number | null
          category: string | null
          created_at: string | null
          frequency: string
          id: string
          name: string
          notes: string | null
          position: number
          section_id: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount?: number
          auto_pay?: boolean
          billing_day?: number | null
          category?: string | null
          created_at?: string | null
          frequency?: string
          id?: string
          name: string
          notes?: string | null
          position?: number
          section_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount?: number
          auto_pay?: boolean
          billing_day?: number | null
          category?: string | null
          created_at?: string | null
          frequency?: string
          id?: string
          name?: string
          notes?: string | null
          position?: number
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "expense_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_items: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string | null
          filed: boolean
          id: string
          name: string
          notes: string | null
          position: number
          section_id: string | null
          tax_year: number
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          due_date?: string | null
          filed?: boolean
          id?: string
          name: string
          notes?: string | null
          position?: number
          section_id?: string | null
          tax_year?: number
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string | null
          filed?: boolean
          id?: string
          name?: string
          notes?: string | null
          position?: number
          section_id?: string | null
          tax_year?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tax_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_sections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          receipt_url: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          receipt_url?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          receipt_url?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
