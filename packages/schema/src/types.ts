export type Database = {
  public: {
    Tables: {
      disciplines: {
        Row: {
          discipline_id: string
          discipline_name: string
          discipline_slug: string
          sort_order: number
          deleted_at: string | null
        }
        Insert: {
          discipline_id?: string
          discipline_name: string
          discipline_slug: string
          sort_order: number
          deleted_at?: string | null
        }
        Update: {
          discipline_id?: string
          discipline_name?: string
          discipline_slug?: string
          sort_order?: number
          deleted_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
