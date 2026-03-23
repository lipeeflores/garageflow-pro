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
      appointments: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          reason: string
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          reason: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          reason?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id?: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["attachment_type"]
          created_at: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          parent_id: string | null
          parent_type: string | null
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          attachment_type?: Database["public"]["Enums"]["attachment_type"]
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          parent_id?: string | null
          parent_type?: string | null
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["attachment_type"]
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          parent_id?: string | null
          parent_type?: string | null
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          internal_notes: string | null
          phone_number: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          internal_notes?: string | null
          phone_number: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          internal_notes?: string | null
          phone_number?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          description: string | null
          entry_date: string
          entry_type: Database["public"]["Enums"]["financial_entry_type"]
          id: string
          payment_id: string | null
          tenant_id: string
          work_order_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          entry_date?: string
          entry_type: Database["public"]["Enums"]["financial_entry_type"]
          id?: string
          payment_id?: string | null
          tenant_id: string
          work_order_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          entry_date?: string
          entry_type?: Database["public"]["Enums"]["financial_entry_type"]
          id?: string
          payment_id?: string | null
          tenant_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          is_sound_played: boolean | null
          message: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          recipient_id: string | null
          tenant_id: string
          title: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          is_sound_played?: boolean | null
          message: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          recipient_id?: string | null
          tenant_id: string
          title: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          is_sound_played?: boolean | null
          message?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          recipient_id?: string | null
          tenant_id?: string
          title?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          processed_by: string | null
          tenant_id: string
          work_order_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          processed_by?: string | null
          tenant_id: string
          work_order_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          processed_by?: string | null
          tenant_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          default_end_time: string | null
          default_lunch_end: string | null
          default_lunch_start: string | null
          default_start_time: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          default_end_time?: string | null
          default_lunch_end?: string | null
          default_lunch_start?: string | null
          default_start_time?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          default_end_time?: string | null
          default_lunch_end?: string | null
          default_lunch_start?: string | null
          default_start_time?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_penalties: {
        Row: {
          created_at: string | null
          id: string
          penalty_points: number
          profile_id: string
          reason: string
          tenant_id: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          penalty_points: number
          profile_id: string
          reason: string
          tenant_id: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          penalty_points?: number
          profile_id?: string
          reason?: string
          tenant_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ranking_penalties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_penalties_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_scores: {
        Row: {
          avg_time_per_os_minutes: number | null
          completed_os_count: number | null
          created_at: string | null
          generated_labor_value: number | null
          id: string
          month: string
          profile_id: string
          punctuality_penalty_points: number | null
          return_penalty_points: number | null
          score: number
          tenant_id: string
          total_work_time_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          avg_time_per_os_minutes?: number | null
          completed_os_count?: number | null
          created_at?: string | null
          generated_labor_value?: number | null
          id?: string
          month: string
          profile_id: string
          punctuality_penalty_points?: number | null
          return_penalty_points?: number | null
          score?: number
          tenant_id: string
          total_work_time_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_time_per_os_minutes?: number | null
          completed_os_count?: number | null
          created_at?: string | null
          generated_labor_value?: number | null
          id?: string
          month?: string
          profile_id?: string
          punctuality_penalty_points?: number | null
          return_penalty_points?: number | null
          score?: number
          tenant_id?: string
          total_work_time_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ranking_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string | null
          end_time: string | null
          entry_type: Database["public"]["Enums"]["time_entry_type"]
          id: string
          profile_id: string
          start_time: string
          tenant_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          entry_type: Database["public"]["Enums"]["time_entry_type"]
          id?: string
          profile_id: string
          start_time?: string
          tenant_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          entry_type?: Database["public"]["Enums"]["time_entry_type"]
          id?: string
          profile_id?: string
          start_time?: string
          tenant_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      timeclock_events: {
        Row: {
          created_at: string | null
          event_time: string
          event_type: Database["public"]["Enums"]["timeclock_event_type"]
          id: string
          ip_address: unknown
          photo_attachment_id: string | null
          profile_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          event_time?: string
          event_type: Database["public"]["Enums"]["timeclock_event_type"]
          id?: string
          ip_address?: unknown
          photo_attachment_id?: string | null
          profile_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          event_time?: string
          event_type?: Database["public"]["Enums"]["timeclock_event_type"]
          id?: string
          ip_address?: unknown
          photo_attachment_id?: string | null
          profile_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeclock_events_photo_attachment_id_fkey"
            columns: ["photo_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeclock_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          chassis: string | null
          color: string | null
          created_at: string | null
          customer_id: string
          id: string
          make: string
          model: string
          notes: string | null
          plate: string
          tenant_id: string
          updated_at: string | null
          year: number | null
        }
        Insert: {
          chassis?: string | null
          color?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          make: string
          model: string
          notes?: string | null
          plate: string
          tenant_id: string
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          chassis?: string | null
          color?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          make?: string
          model?: string
          notes?: string | null
          plate?: string
          tenant_id?: string
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_checkins: {
        Row: {
          checked_in_at: string | null
          created_at: string | null
          customer_items: string | null
          fuel_level: Database["public"]["Enums"]["fuel_level"]
          id: string
          km_current: number
          mechanic_id: string | null
          observations: string | null
          tenant_id: string
          work_order_id: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string | null
          customer_items?: string | null
          fuel_level: Database["public"]["Enums"]["fuel_level"]
          id?: string
          km_current: number
          mechanic_id?: string | null
          observations?: string | null
          tenant_id: string
          work_order_id: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string | null
          customer_items?: string | null
          fuel_level?: Database["public"]["Enums"]["fuel_level"]
          id?: string
          km_current?: number
          mechanic_id?: string | null
          observations?: string | null
          tenant_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_checkins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_checkins_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_diagnostics: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          mechanic_id: string
          started_at: string
          technical_report: string
          tenant_id: string
          transcription_raw: string | null
          transcription_refined: string | null
          voice_memo_url: string | null
          work_order_id: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          mechanic_id: string
          started_at?: string
          technical_report: string
          tenant_id: string
          transcription_raw?: string | null
          transcription_refined?: string | null
          voice_memo_url?: string | null
          work_order_id: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          mechanic_id?: string
          started_at?: string
          technical_report?: string
          tenant_id?: string
          transcription_raw?: string | null
          transcription_refined?: string | null
          voice_memo_url?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_diagnostics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_diagnostics_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_events: {
        Row: {
          actor_id: string | null
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          tenant_id: string
          work_order_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          tenant_id: string
          work_order_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          tenant_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          part_code: string | null
          quantity: number
          tenant_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          item_type: Database["public"]["Enums"]["item_type"]
          part_code?: string | null
          quantity?: number
          tenant_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          part_code?: string | null
          quantity?: number
          tenant_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_pricing: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          is_approved: boolean | null
          tenant_id: string
          total_price: number
          unit_cost: number | null
          unit_price: number
          updated_at: string | null
          work_order_item_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          tenant_id: string
          total_price: number
          unit_cost?: number | null
          unit_price: number
          updated_at?: string | null
          work_order_item_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          tenant_id?: string
          total_price?: number
          unit_cost?: number | null
          unit_price?: number
          updated_at?: string | null
          work_order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_pricing_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_pricing_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: true
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_quality: {
        Row: {
          created_at: string | null
          id: string
          inspected_at: string | null
          manager_id: string
          notes: string | null
          status: Database["public"]["Enums"]["quality_status"]
          tenant_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          inspected_at?: string | null
          manager_id: string
          notes?: string | null
          status: Database["public"]["Enums"]["quality_status"]
          tenant_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          inspected_at?: string | null
          manager_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["quality_status"]
          tenant_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_quality_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_quality_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_returns: {
        Row: {
          created_at: string | null
          id: string
          mechanic_blamed_id: string | null
          original_work_order_id: string
          reason: string
          return_date: string
          return_work_order_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mechanic_blamed_id?: string | null
          original_work_order_id: string
          reason: string
          return_date?: string
          return_work_order_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mechanic_blamed_id?: string | null
          original_work_order_id?: string
          reason?: string
          return_date?: string
          return_work_order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_returns_original_work_order_id_fkey"
            columns: ["original_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_returns_return_work_order_id_fkey"
            columns: ["return_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          appointment_id: string | null
          box_location: Database["public"]["Enums"]["box_location"] | null
          created_at: string | null
          created_by: string | null
          current_mechanic_id: string | null
          customer_id: string
          expected_delivery_date: string | null
          id: string
          initial_complaint: string | null
          order_type: Database["public"]["Enums"]["work_order_type"] | null
          original_work_order_id: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          tenant_id: string
          total_amount: number | null
          updated_at: string | null
          vehicle_id: string
          workflow_step: Database["public"]["Enums"]["workflow_step"]
        }
        Insert: {
          appointment_id?: string | null
          box_location?: Database["public"]["Enums"]["box_location"] | null
          created_at?: string | null
          created_by?: string | null
          current_mechanic_id?: string | null
          customer_id: string
          expected_delivery_date?: string | null
          id?: string
          initial_complaint?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          original_work_order_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string | null
          vehicle_id: string
          workflow_step?: Database["public"]["Enums"]["workflow_step"]
        }
        Update: {
          appointment_id?: string | null
          box_location?: Database["public"]["Enums"]["box_location"] | null
          created_at?: string | null
          created_by?: string | null
          current_mechanic_id?: string | null
          customer_id?: string
          expected_delivery_date?: string | null
          id?: string
          initial_complaint?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          original_work_order_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string | null
          vehicle_id?: string
          workflow_step?: Database["public"]["Enums"]["workflow_step"]
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_original_work_order_id_fkey"
            columns: ["original_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_tenant: {
        Args: { resource_tenant_id: string; user_id: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_tenant_id: { Args: { user_id: string }; Returns: string }
      has_role: {
        Args: {
          required_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_admin_or_manager: { Args: { user_id: string }; Returns: boolean }
      is_manager: { Args: { user_id: string }; Returns: boolean }
      is_mechanic: { Args: { user_id: string }; Returns: boolean }
      mark_expired_appointments: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "ADMIN" | "MANAGER" | "MECHANIC" | "PATIO"
      appointment_status:
        | "AGENDADO"
        | "CHEGOU"
        | "NAO_COMPARECEU"
        | "REMARCADO"
        | "CANCELADO"
      attachment_type:
        | "CHECKIN_PHOTO"
        | "DIAGNOSIS_PHOTO"
        | "DIAGNOSIS_AUDIO"
        | "EXECUTION_PHOTO"
        | "TIMECLOCK_PHOTO"
        | "OTHER"
      box_location: "BOX_1" | "BOX_2" | "BOX_3" | "BOX_4" | "PATIO"
      financial_entry_type: "RECEITA" | "DESPESA"
      fuel_level: "RESERVA" | "QUARTO" | "METADE" | "TRES_QUARTOS" | "COMPLETO"
      item_type: "SERVICE" | "PART"
      notification_type:
        | "ORCAMENTO_PENDENTE"
        | "QC_PENDENTE"
        | "OS_APROVADA"
        | "CARRO_LIBERADO"
        | "ATRASO_AGENDAMENTO"
        | "LEMBRETE_AGENDAMENTO"
        | "DIAGNOSTICO_INICIADO"
        | "NOVA_OS"
      payment_method: "PIX" | "CARTAO" | "DINHEIRO" | "MARCAR"
      priority_level: "BAIXA" | "MEDIA" | "ALTA"
      quality_status: "APROVADO" | "DEVOLVIDO_AJUSTES"
      time_entry_type: "DIAGNOSIS" | "EXECUTION" | "ADJUSTMENT"
      timeclock_event_type:
        | "ENTRADA"
        | "SAIDA_ALMOCO"
        | "RETORNO_ALMOCO"
        | "SAIDA"
      work_order_type: "NORMAL" | "RETORNO"
      workflow_step:
        | "AGUARDANDO_CHECKIN"
        | "CHECKIN_CONCLUIDO"
        | "EM_DIAGNOSTICO"
        | "AGUARDANDO_ORCAMENTO"
        | "AGUARDANDO_APROVACAO"
        | "APROVADO"
        | "EM_EXECUCAO"
        | "EM_QUALIDADE"
        | "AJUSTES"
        | "PRONTO_PARA_RETIRADA"
        | "FINALIZADO"
        | "CANCELADO"
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
      app_role: ["ADMIN", "MANAGER", "MECHANIC", "PATIO"],
      appointment_status: [
        "AGENDADO",
        "CHEGOU",
        "NAO_COMPARECEU",
        "REMARCADO",
        "CANCELADO",
      ],
      attachment_type: [
        "CHECKIN_PHOTO",
        "DIAGNOSIS_PHOTO",
        "DIAGNOSIS_AUDIO",
        "EXECUTION_PHOTO",
        "TIMECLOCK_PHOTO",
        "OTHER",
      ],
      box_location: ["BOX_1", "BOX_2", "BOX_3", "BOX_4", "PATIO"],
      financial_entry_type: ["RECEITA", "DESPESA"],
      fuel_level: ["RESERVA", "QUARTO", "METADE", "TRES_QUARTOS", "COMPLETO"],
      item_type: ["SERVICE", "PART"],
      notification_type: [
        "ORCAMENTO_PENDENTE",
        "QC_PENDENTE",
        "OS_APROVADA",
        "CARRO_LIBERADO",
        "ATRASO_AGENDAMENTO",
        "LEMBRETE_AGENDAMENTO",
        "DIAGNOSTICO_INICIADO",
        "NOVA_OS",
      ],
      payment_method: ["PIX", "CARTAO", "DINHEIRO", "MARCAR"],
      priority_level: ["BAIXA", "MEDIA", "ALTA"],
      quality_status: ["APROVADO", "DEVOLVIDO_AJUSTES"],
      time_entry_type: ["DIAGNOSIS", "EXECUTION", "ADJUSTMENT"],
      timeclock_event_type: [
        "ENTRADA",
        "SAIDA_ALMOCO",
        "RETORNO_ALMOCO",
        "SAIDA",
      ],
      work_order_type: ["NORMAL", "RETORNO"],
      workflow_step: [
        "AGUARDANDO_CHECKIN",
        "CHECKIN_CONCLUIDO",
        "EM_DIAGNOSTICO",
        "AGUARDANDO_ORCAMENTO",
        "AGUARDANDO_APROVACAO",
        "APROVADO",
        "EM_EXECUCAO",
        "EM_QUALIDADE",
        "AJUSTES",
        "PRONTO_PARA_RETIRADA",
        "FINALIZADO",
        "CANCELADO",
      ],
    },
  },
} as const
