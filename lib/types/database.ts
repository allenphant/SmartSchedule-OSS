// ============================================
// Database Types - TypeScript 型別定義
// 使用 Supabase 官方格式
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'manager' | 'staff';
export type EmploymentType = 'fulltime' | 'parttime';
export type AvailabilityType = 'available' | 'leave';
export type MonthStatus = 'draft' | 'published' | 'locked';

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: number;
          store_id: string;
          user_id: string | null;
          action: string;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          store_id: string;
          user_id?: string | null;
          action: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          store_id?: string;
          user_id?: string | null;
          action?: string;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      availabilities: {
        Row: {
          id: number;
          store_id: string;
          user_id: string;
          date: string;
          slots: string[];
          type: AvailabilityType;
          leave_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          store_id: string;
          user_id: string;
          date: string;
          slots: string[];
          type: AvailabilityType;
          leave_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          store_id?: string;
          user_id?: string;
          date?: string;
          slots?: string[];
          type?: AvailabilityType;
          leave_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availabilities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ];
      };
      manager_stores: {
        Row: {
          manager_id: string;
          store_id: string;
        };
        Insert: {
          manager_id: string;
          store_id: string;
        };
        Update: {
          manager_id?: string;
          store_id?: string;
        };
        Relationships: [];
      };
      monthly_configs: {
        Row: {
          id: number;
          store_id: string;
          year_month: string;
          status: MonthStatus;
          closed_dates: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          store_id: string;
          year_month: string;
          status?: MonthStatus;
          closed_dates?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          store_id?: string;
          year_month?: string;
          status?: MonthStatus;
          closed_dates?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          store_id: string;
          full_name: string;
          role: UserRole;
          employment_type: EmploymentType;
          hourly_rate: number;
          avatar_url: string | null;
          is_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          store_id: string;
          full_name: string;
          role?: UserRole;
          employment_type?: EmploymentType;
          hourly_rate?: number;
          avatar_url?: string | null;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          full_name?: string;
          role?: UserRole;
          employment_type?: EmploymentType;
          hourly_rate?: number;
          avatar_url?: string | null;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shift_templates: {
        Row: {
          id: number;
          store_id: string;
          name: string;
          start_time: string;
          end_time: string;
          break_start: string | null;
          break_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          store_id: string;
          name: string;
          start_time: string;
          end_time: string;
          break_start?: string | null;
          break_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          store_id?: string;
          name?: string;
          start_time?: string;
          end_time?: string;
          break_start?: string | null;
          break_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shifts: {
        Row: {
          id: number;
          store_id: string;
          user_id: string;
          date: string;
          assigned_slots: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          store_id: string;
          user_id: string;
          date: string;
          assigned_slots: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          store_id?: string;
          user_id?: string;
          date?: string;
          assigned_slots?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ];
      };
      registration_confirmations: {
        Row: {
          id: string;
          user_id: string;
          store_id: string;
          year_month: string;
          period: number;
          confirmed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          store_id: string;
          year_month: string;
          period: number;
          confirmed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          store_id?: string;
          year_month?: string;
          period?: number;
          confirmed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registration_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ];
      };
      stores: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Export 方便使用的型別 shortcuts
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// 具體型別 export
export type Store = Tables<'stores'>;
export type Profile = Tables<'profiles'>;
export type Availability = Tables<'availabilities'>;
export type Shift = Tables<'shifts'>;
export type MonthlyConfig = Tables<'monthly_configs'>;
export type ShiftTemplate = Tables<'shift_templates'>;
export type AuditLog = Tables<'audit_logs'>;
