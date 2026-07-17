export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      diary_entries: {
        Row: {
          brand_name: string | null
          calories: number | null
          carbohydrates_g: number | null
          created_at: string
          entry_date: string
          fat_g: number | null
          food_id: string | null
          food_name: string
          id: string
          meal_type: string
          notes: string | null
          protein_g: number | null
          recipe_diary_run_id: string | null
          saved_meal_diary_run_id: string | null
          saved_meal_item_position: number | null
          serving_quantity: number | null
          serving_unit: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_name?: string | null
          calories?: number | null
          carbohydrates_g?: number | null
          created_at?: string
          entry_date: string
          fat_g?: number | null
          food_id?: string | null
          food_name: string
          id?: string
          meal_type: string
          notes?: string | null
          protein_g?: number | null
          recipe_diary_run_id?: string | null
          saved_meal_diary_run_id?: string | null
          saved_meal_item_position?: number | null
          serving_quantity?: number | null
          serving_unit?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_name?: string | null
          calories?: number | null
          carbohydrates_g?: number | null
          created_at?: string
          entry_date?: string
          fat_g?: number | null
          food_id?: string | null
          food_name?: string
          id?: string
          meal_type?: string
          notes?: string | null
          protein_g?: number | null
          recipe_diary_run_id?: string | null
          saved_meal_diary_run_id?: string | null
          saved_meal_item_position?: number | null
          serving_quantity?: number | null
          serving_unit?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entries_recipe_diary_run_id_fkey"
            columns: ["recipe_diary_run_id"]
            isOneToOne: true
            referencedRelation: "recipe_diary_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entries_saved_meal_diary_run_id_fkey"
            columns: ["saved_meal_diary_run_id"]
            isOneToOne: false
            referencedRelation: "saved_meal_diary_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      food_aliases: {
        Row: {
          alias_text: string
          created_at: string
          food_id: string
          id: string
          language_code: string
          normalized_alias: string
          updated_at: string
        }
        Insert: {
          alias_text: string
          created_at?: string
          food_id: string
          id?: string
          language_code: string
          normalized_alias?: string
          updated_at?: string
        }
        Update: {
          alias_text?: string
          created_at?: string
          food_id?: string
          id?: string
          language_code?: string
          normalized_alias?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_aliases_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_barcodes: {
        Row: {
          canonical_gtin: string
          created_at: string
          food_id: string
          id: string
          provenance_source_food_id: string | null
          provenance_source_id: string
          scope_owner_user_id: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          canonical_gtin: string
          created_at?: string
          food_id: string
          id?: string
          provenance_source_food_id?: string | null
          provenance_source_id: string
          scope_owner_user_id?: string | null
          updated_at?: string
          verification_status: string
        }
        Update: {
          canonical_gtin?: string
          created_at?: string
          food_id?: string
          id?: string
          provenance_source_food_id?: string | null
          provenance_source_id?: string
          scope_owner_user_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_barcodes_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_barcodes_provenance_source_id_fkey"
            columns: ["provenance_source_id"]
            isOneToOne: false
            referencedRelation: "food_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      food_favorites: {
        Row: {
          created_at: string
          food_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_favorites_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_nutrients: {
        Row: {
          amount: number
          basis: string
          created_at: string
          food_id: string
          id: string
          nutrient_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          basis?: string
          created_at?: string
          food_id: string
          id?: string
          nutrient_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          basis?: string
          created_at?: string
          food_id?: string
          id?: string
          nutrient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_nutrients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrients_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrients"
            referencedColumns: ["id"]
          },
        ]
      }
      food_sources: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_external: boolean
          name: string
          source_type: string
          trust_level: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_external?: boolean
          name: string
          source_type: string
          trust_level: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_external?: boolean
          name?: string
          source_type?: string
          trust_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      foods: {
        Row: {
          brand_name: string | null
          created_at: string
          custom_nutrient_basis: string | null
          data_quality: string
          food_type: string
          id: string
          is_archived: boolean
          is_public: boolean
          locale: string | null
          name: string
          owner_user_id: string | null
          serving_size: number | null
          serving_unit: string | null
          source_food_id: string | null
          source_id: string | null
          updated_at: string
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          custom_nutrient_basis?: string | null
          data_quality?: string
          food_type: string
          id?: string
          is_archived?: boolean
          is_public?: boolean
          locale?: string | null
          name: string
          owner_user_id?: string | null
          serving_size?: number | null
          serving_unit?: string | null
          source_food_id?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          custom_nutrient_basis?: string | null
          data_quality?: string
          food_type?: string
          id?: string
          is_archived?: boolean
          is_public?: boolean
          locale?: string | null
          name?: string
          owner_user_id?: string | null
          serving_size?: number | null
          serving_unit?: string | null
          source_food_id?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "food_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrients: {
        Row: {
          code: string
          created_at: string
          display_order: number
          id: string
          is_energy: boolean
          is_macro: boolean
          is_required_for_mvp: boolean
          name_en: string
          name_he: string | null
          nutrient_group: string
          unit: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          id?: string
          is_energy?: boolean
          is_macro?: boolean
          is_required_for_mvp?: boolean
          name_en: string
          name_he?: string | null
          nutrient_group: string
          unit: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          is_energy?: boolean
          is_macro?: boolean
          is_required_for_mvp?: boolean
          name_en?: string
          name_he?: string | null
          nutrient_group?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      nutrition_targets: {
        Row: {
          calories: number | null
          carbohydrates_g: number | null
          created_at: string
          effective_from: string
          fat_g: number | null
          id: string
          protein_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbohydrates_g?: number | null
          created_at?: string
          effective_from?: string
          fat_g?: number | null
          id?: string
          protein_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number | null
          carbohydrates_g?: number | null
          created_at?: string
          effective_from?: string
          fat_g?: number | null
          id?: string
          protein_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferred_language: string
          unit_system: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferred_language?: string
          unit_system?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_language?: string
          unit_system?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_diary_runs: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          idempotency_key: string
          meal_type: string
          recipe_id: string | null
          requested_servings: number
          source_updated_at: string
          user_id: string
          write_transaction_id: unknown
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          idempotency_key: string
          meal_type: string
          recipe_id?: string | null
          requested_servings: number
          source_updated_at: string
          user_id: string
          write_transaction_id?: unknown
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          idempotency_key?: string
          meal_type?: string
          recipe_id?: string | null
          requested_servings?: number
          source_updated_at?: string
          user_id?: string
          write_transaction_id?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "recipe_diary_runs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          brand_name: string | null
          calories: number | null
          carbohydrates_g: number | null
          created_at: string
          fat_g: number | null
          food_id: string | null
          id: string
          ingredient_name: string
          notes: string | null
          position: number
          protein_g: number | null
          quantity: number | null
          recipe_id: string
          unit: string | null
        }
        Insert: {
          brand_name?: string | null
          calories?: number | null
          carbohydrates_g?: number | null
          created_at?: string
          fat_g?: number | null
          food_id?: string | null
          id?: string
          ingredient_name: string
          notes?: string | null
          position: number
          protein_g?: number | null
          quantity?: number | null
          recipe_id: string
          unit?: string | null
        }
        Update: {
          brand_name?: string | null
          calories?: number | null
          carbohydrates_g?: number | null
          created_at?: string
          fat_g?: number | null
          food_id?: string | null
          id?: string
          ingredient_name?: string
          notes?: string | null
          position?: number
          protein_g?: number | null
          quantity?: number | null
          recipe_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          locale: string
          name: string
          updated_at: string
          user_id: string
          yield_servings: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          locale: string
          name: string
          updated_at?: string
          user_id: string
          yield_servings: number
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          locale?: string
          name?: string
          updated_at?: string
          user_id?: string
          yield_servings?: number
        }
        Relationships: []
      }
      saved_meal_diary_runs: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          idempotency_key: string
          item_count: number
          meal_type: string
          saved_meal_id: string | null
          source_updated_at: string
          user_id: string
          write_transaction_id: unknown
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          idempotency_key: string
          item_count: number
          meal_type: string
          saved_meal_id?: string | null
          source_updated_at: string
          user_id: string
          write_transaction_id?: unknown
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          idempotency_key?: string
          item_count?: number
          meal_type?: string
          saved_meal_id?: string | null
          source_updated_at?: string
          user_id?: string
          write_transaction_id?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "saved_meal_diary_runs_saved_meal_id_fkey"
            columns: ["saved_meal_id"]
            isOneToOne: false
            referencedRelation: "saved_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_meal_items: {
        Row: {
          brand_name: string | null
          calories: number | null
          carbohydrates_g: number | null
          created_at: string
          fat_g: number | null
          food_id: string | null
          food_name: string
          id: string
          notes: string | null
          position: number
          protein_g: number | null
          saved_meal_id: string
          serving_quantity: number | null
          serving_unit: string | null
        }
        Insert: {
          brand_name?: string | null
          calories?: number | null
          carbohydrates_g?: number | null
          created_at?: string
          fat_g?: number | null
          food_id?: string | null
          food_name: string
          id?: string
          notes?: string | null
          position: number
          protein_g?: number | null
          saved_meal_id: string
          serving_quantity?: number | null
          serving_unit?: string | null
        }
        Update: {
          brand_name?: string | null
          calories?: number | null
          carbohydrates_g?: number | null
          created_at?: string
          fat_g?: number | null
          food_id?: string | null
          food_name?: string
          id?: string
          notes?: string | null
          position?: number
          protein_g?: number | null
          saved_meal_id?: string
          serving_quantity?: number | null
          serving_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_meal_items_saved_meal_id_fkey"
            columns: ["saved_meal_id"]
            isOneToOne: false
            referencedRelation: "saved_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_meals: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          locale: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          locale: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          locale?: string
          name?: string
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
      get_owned_custom_food_editor: {
        Args: { p_food_id: string }
        Returns: {
          aliases: Json
          brand_name: string
          food_id: string
          is_archived: boolean
          locale: string
          name: string
          nutrient_basis: string
          nutrients: Json
          serving_quantity: number
          serving_unit: string
        }[]
      }
      get_owned_recipe_editor: {
        Args: { p_recipe_id: string }
        Returns: {
          created_at: string
          ingredients: Json
          is_archived: boolean
          locale: string
          name: string
          recipe_id: string
          updated_at: string
          yield_servings: number
        }[]
      }
      get_owned_recipe_use_contract: {
        Args: { p_recipe_id: string; p_requested_servings: number }
        Returns: {
          calories_complete: boolean
          calories_known_ingredient_count: number
          calories_per_serving: number
          calories_requested: number
          calories_whole_recipe: number
          carbohydrates_complete: boolean
          carbohydrates_known_ingredient_count: number
          carbohydrates_per_serving: number
          carbohydrates_requested: number
          carbohydrates_whole_recipe: number
          diary_calories: number
          diary_carbohydrates_g: number
          diary_fat_g: number
          diary_protein_g: number
          fat_complete: boolean
          fat_known_ingredient_count: number
          fat_per_serving: number
          fat_requested: number
          fat_whole_recipe: number
          ingredient_count: number
          is_archived: boolean
          protein_complete: boolean
          protein_known_ingredient_count: number
          protein_per_serving: number
          protein_requested: number
          protein_whole_recipe: number
          recipe_id: string
          recipe_locale: string
          recipe_name: string
          requested_servings: number
          result_status: string
          source_updated_at: string
          yield_servings: number
        }[]
      }
      get_owned_saved_meal_editor: {
        Args: { p_saved_meal_id: string }
        Returns: {
          created_at: string
          is_archived: boolean
          items: Json
          locale: string
          name: string
          saved_meal_id: string
          updated_at: string
        }[]
      }
      get_readable_food_diary_prefill: {
        Args: { p_food_id: string }
        Returns: {
          brand_name: string
          calories: number
          carbohydrates_g: number
          data_quality: string
          fat_g: number
          food_id: string
          food_type: string
          is_owned: boolean
          name: string
          nutrient_basis: string
          protein_g: number
          serving_quantity: number
          serving_unit: string
          source_code: string
          source_name: string
        }[]
      }
      get_reusable_foods: {
        Args: never
        Returns: {
          brand_name: string
          collection_type: string
          data_quality: string
          favorited_at: string
          food_id: string
          food_type: string
          is_favorite: boolean
          is_owned: boolean
          last_used_at: string
          locale: string
          name: string
          serving_size: number
          serving_unit: string
          source_code: string
          source_name: string
          source_trust_level: string
          source_type: string
        }[]
      }
      is_valid_canonical_gtin: { Args: { p_gtin: string }; Returns: boolean }
      log_recipe_to_diary: {
        Args: {
          p_entry_date: string
          p_expected_updated_at: string
          p_idempotency_key: string
          p_meal_type: string
          p_recipe_id: string
          p_requested_servings: number
        }
        Returns: {
          created_entry_count: number
          diary_run_id: string
          result_status: string
        }[]
      }
      log_saved_meal_to_diary: {
        Args: {
          p_entry_date: string
          p_expected_updated_at: string
          p_idempotency_key: string
          p_meal_type: string
          p_saved_meal_id: string
        }
        Returns: {
          diary_run_id: string
          item_count: number
          result_status: string
        }[]
      }
      lookup_readable_food_by_gtin: {
        Args: { p_gtin: string }
        Returns: {
          brand_name: string
          canonical_gtin: string
          food_data_quality: string
          food_id: string
          food_locale: string
          food_name: string
          food_source_code: string
          food_source_name: string
          food_source_trust_level: string
          food_source_type: string
          food_type: string
          mapping_provenance_source_code: string
          mapping_provenance_source_food_id: string
          mapping_provenance_source_name: string
          mapping_provenance_source_trust_level: string
          mapping_provenance_source_type: string
          mapping_verification_status: string
          ownership_kind: string
          result_status: string
          serving_size: number
          serving_unit: string
        }[]
      }
      normalize_food_search_text: { Args: { value: string }; Returns: string }
      persist_custom_food: {
        Args: {
          p_aliases: Json
          p_brand_name: string
          p_food_id: string
          p_locale: string
          p_name: string
          p_nutrient_basis: string
          p_nutrients: Json
          p_serving_quantity: number
          p_serving_unit: string
        }
        Returns: {
          food_id: string
          is_archived: boolean
          nutrient_basis: string
        }[]
      }
      persist_recipe: {
        Args: {
          p_ingredients: Json
          p_locale: string
          p_name: string
          p_recipe_id: string
          p_yield_servings: number
        }
        Returns: {
          ingredient_count: number
          is_archived: boolean
          recipe_id: string
        }[]
      }
      persist_saved_meal: {
        Args: {
          p_items: Json
          p_locale: string
          p_name: string
          p_saved_meal_id: string
        }
        Returns: {
          is_archived: boolean
          item_count: number
          saved_meal_id: string
        }[]
      }
      persist_setup: {
        Args: {
          p_calories: number
          p_carbohydrates_g: number
          p_display_name: string
          p_effective_from: string
          p_fat_g: number
          p_preferred_language: string
          p_protein_g: number
        }
        Returns: {
          preferred_language: string
          profile_id: string
          target_id: string
        }[]
      }
      search_readable_foods: {
        Args: { p_query: string }
        Returns: {
          brand_name: string
          data_quality: string
          food_id: string
          food_type: string
          is_favorite: boolean
          is_owned: boolean
          locale: string
          match_category: string
          matched_alias: string
          name: string
          serving_size: number
          serving_unit: string
          source_code: string
          source_name: string
          source_trust_level: string
          source_type: string
        }[]
      }
      set_custom_food_archived: {
        Args: { p_food_id: string; p_is_archived: boolean }
        Returns: {
          food_id: string
          is_archived: boolean
        }[]
      }
      set_food_favorite: {
        Args: { p_food_id: string; p_is_favorite: boolean }
        Returns: {
          food_id: string
          is_favorite: boolean
        }[]
      }
      set_recipe_archived: {
        Args: { p_is_archived: boolean; p_recipe_id: string }
        Returns: {
          is_archived: boolean
          recipe_id: string
        }[]
      }
      set_saved_meal_archived: {
        Args: { p_is_archived: boolean; p_saved_meal_id: string }
        Returns: {
          is_archived: boolean
          saved_meal_id: string
        }[]
      }
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

