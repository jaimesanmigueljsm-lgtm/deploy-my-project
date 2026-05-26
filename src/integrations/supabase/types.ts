export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
          row_id: string | null;
          table_name: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          row_id?: string | null;
          table_name: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          row_id?: string | null;
          table_name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          active: boolean;
          amount: number;
          category: string | null;
          created_at: string;
          due_day: number;
          id: string;
          name: string;
          paid_this_month: boolean;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          amount: number;
          category?: string | null;
          created_at?: string;
          due_day?: number;
          id?: string;
          name: string;
          paid_this_month?: boolean;
          user_id: string;
        };
        Update: {
          active?: boolean;
          amount?: number;
          category?: string | null;
          created_at?: string;
          due_day?: number;
          id?: string;
          name?: string;
          paid_this_month?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          color: string;
          created_at: string;
          icon: string;
          id: string;
          kind: string;
          name: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          kind?: string;
          name: string;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          kind?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          description: string;
          id: string;
          kind: string;
          recurring: boolean;
          spent_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          kind?: string;
          recurring?: boolean;
          spent_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          kind?: string;
          recurring?: boolean;
          spent_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      families: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
      family_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string | null;
          expires_at: string;
          family_id: string;
          id: string;
          invited_by: string;
          invited_user_id: string | null;
          role: string;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          family_id: string;
          id?: string;
          invited_by: string;
          invited_user_id?: string | null;
          role?: string;
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          family_id?: string;
          id?: string;
          invited_by?: string;
          invited_user_id?: string | null;
          role?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_invitations_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      family_members: {
        Row: {
          created_at: string;
          display_name: string | null;
          family_id: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          family_id: string;
          id?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          family_id?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      goal_contributions: {
        Row: {
          amount: number;
          contributed_at: string;
          created_at: string;
          goal_id: string;
          id: string;
          note: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          contributed_at?: string;
          created_at?: string;
          goal_id: string;
          id?: string;
          note?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          contributed_at?: string;
          created_at?: string;
          goal_id?: string;
          id?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_fk";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "savings_goals";
            referencedColumns: ["id"];
          },
        ];
      };
      incomes: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          received_at: string;
          recurring: boolean;
          source: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          received_at?: string;
          recurring?: boolean;
          source: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          received_at?: string;
          recurring?: boolean;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      investment_history: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          investment_id: string;
          user_id: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          date?: string;
          id?: string;
          investment_id: string;
          user_id: string;
          value: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          investment_id?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "investment_history_investment_id_fkey";
            columns: ["investment_id"];
            isOneToOne: false;
            referencedRelation: "investments";
            referencedColumns: ["id"];
          },
        ];
      };
      investments: {
        Row: {
          avg_cost: number;
          created_at: string;
          currency: string;
          current_price: number;
          id: string;
          last_updated: string;
          name: string;
          notes: string | null;
          quantity: number;
          ticker: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          avg_cost?: number;
          created_at?: string;
          currency?: string;
          current_price?: number;
          id?: string;
          last_updated?: string;
          name: string;
          notes?: string | null;
          quantity?: number;
          ticker?: string | null;
          type?: string;
          user_id: string;
        };
        Update: {
          avg_cost?: number;
          created_at?: string;
          currency?: string;
          current_price?: number;
          id?: string;
          last_updated?: string;
          name?: string;
          notes?: string | null;
          quantity?: number;
          ticker?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address: string | null;
          avatar_url: string | null;
          base_currency: string | null;
          created_at: string;
          currency: string;
          family_id: string | null;
          financial_username: string;
          first_name: string;
          full_name: string | null;
          health_score: number;
          id: string;
          last_name_1: string;
          last_name_2: string | null;
          monthly_savings_target: number;
          notification_prefs: Json;
          onboarded: boolean;
          priorities: string[] | null;
          theme: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          avatar_url?: string | null;
          base_currency?: string | null;
          created_at?: string;
          currency?: string;
          family_id?: string | null;
          financial_username: string;
          first_name: string;
          full_name?: string | null;
          health_score?: number;
          id: string;
          last_name_1: string;
          last_name_2?: string | null;
          monthly_savings_target?: number;
          notification_prefs?: Json;
          onboarded?: boolean;
          priorities?: string[] | null;
          theme?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          avatar_url?: string | null;
          base_currency?: string | null;
          created_at?: string;
          currency?: string;
          family_id?: string | null;
          financial_username?: string;
          first_name?: string;
          full_name?: string | null;
          health_score?: number;
          id?: string;
          last_name_1?: string;
          last_name_2?: string | null;
          monthly_savings_target?: number;
          notification_prefs?: Json;
          onboarded?: boolean;
          priorities?: string[] | null;
          theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          severity: string;
          title: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          severity?: string;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          severity?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      savings_goals: {
        Row: {
          category: string;
          color: string;
          created_at: string;
          current_amount: number;
          deadline: string | null;
          icon: string;
          id: string;
          monthly_contribution: number;
          name: string;
          notes: string | null;
          priority: string;
          target_amount: number;
          user_id: string;
        };
        Insert: {
          category?: string;
          color?: string;
          created_at?: string;
          current_amount?: number;
          deadline?: string | null;
          icon?: string;
          id?: string;
          monthly_contribution?: number;
          name: string;
          notes?: string | null;
          priority?: string;
          target_amount: number;
          user_id: string;
        };
        Update: {
          category?: string;
          color?: string;
          created_at?: string;
          current_amount?: number;
          deadline?: string | null;
          icon?: string;
          id?: string;
          monthly_contribution?: number;
          name?: string;
          notes?: string | null;
          priority?: string;
          target_amount?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      shared_goals: {
        Row: {
          created_at: string;
          current_amount: number;
          deadline: string | null;
          family_id: string;
          id: string;
          name: string;
          target_amount: number;
        };
        Insert: {
          created_at?: string;
          current_amount?: number;
          deadline?: string | null;
          family_id: string;
          id?: string;
          name: string;
          target_amount: number;
        };
        Update: {
          created_at?: string;
          current_amount?: number;
          deadline?: string | null;
          family_id?: string;
          id?: string;
          name?: string;
          target_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "shared_goals_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_family_invite: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      add_goal_contribution: {
        Args: {
          p_amount: number;
          p_goal_id: string;
          p_note?: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      find_user_by_username: {
        Args: { p_username: string };
        Returns: {
          financial_username: string;
          first_name: string;
          id: string;
          last_name_1: string;
        }[];
      };
      generate_financial_username: {
        Args: { p_first_name: string; p_last_name_1: string };
        Returns: string;
      };
      get_family_sent_invitations: {
        Args: { p_family_id: string };
        Returns: {
          created_at: string;
          expires_at: string;
          id: string;
          invited_first_name: string;
          invited_last_name_1: string;
          invited_user_id: string;
          invited_username: string;
          role: string;
        }[];
      };
      get_my_invitations: {
        Args: never;
        Returns: {
          created_at: string;
          expires_at: string;
          family_id: string;
          family_name: string;
          id: string;
          invited_by_first_name: string;
          invited_by_last_name_1: string;
          invited_by_username: string;
          role: string;
        }[];
      };
      is_family_member: {
        Args: { _family_id: string; _user_id: string };
        Returns: boolean;
      };
      is_family_owner: {
        Args: { _family_id: string; _user_id: string };
        Returns: boolean;
      };
      reject_family_invite: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      send_family_invite: {
        Args: { p_family_id: string; p_username: string };
        Returns: string;
      };
      unaccent: { Args: { "": string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
