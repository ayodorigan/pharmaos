import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for database
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          phone: string
          role: 'super_admin' | 'pharmtech' | 'cashier'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          phone: string
          role?: 'super_admin' | 'pharmtech' | 'cashier'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string
          role?: 'super_admin' | 'pharmtech' | 'cashier'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          category: string
          supplier: string
          batch_number: string
          expiry_date: string
          cost_price: number
          selling_price: number
          stock_level: number
          min_stock_level: number
          barcode: string | null
          requires_prescription: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          supplier: string
          batch_number: string
          expiry_date: string
          cost_price: number
          selling_price: number
          stock_level: number
          min_stock_level: number
          barcode?: string | null
          requires_prescription?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          supplier?: string
          batch_number?: string
          expiry_date?: string
          cost_price?: number
          selling_price?: number
          stock_level?: number
          min_stock_level?: number
          barcode?: string | null
          requires_prescription?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          receipt_number: string
          subtotal: number
          tax: number
          total: number
          payment_method: 'cash' | 'mpesa' | 'card' | 'insurance'
          mpesa_transaction_id: string | null
          staff_id: string
          created_at: string
        }
        Insert: {
          id?: string
          receipt_number: string
          subtotal: number
          tax: number
          total: number
          payment_method: 'cash' | 'mpesa' | 'card' | 'insurance'
          mpesa_transaction_id?: string | null
          staff_id: string
          created_at?: string
        }
        Update: {
          id?: string
          receipt_number?: string
          subtotal?: number
          tax?: number
          total?: number
          payment_method?: 'cash' | 'mpesa' | 'card' | 'insurance'
          mpesa_transaction_id?: string | null
          staff_id?: string
          created_at?: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          total: number
        }
        Insert: {
          id?: string
          sale_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          total: number
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          total?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'super_admin' | 'pharmtech' | 'cashier'
      payment_method: 'cash' | 'mpesa' | 'card' | 'insurance'
    }
  }
}