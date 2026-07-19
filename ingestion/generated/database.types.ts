export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  ingestion: {
    Tables: {
      data_sources: {
        Row: {
          approval_reference: string
          approval_status: string
          attribution_text: string | null
          classification: string
          code: string
          created_at: string
          id: string
          legal_name: string
          license_identifier: string | null
          license_url: string | null
          terms_effective_date: string | null
          updated_at: string
        }
        Insert: {
          approval_reference: string
          approval_status: string
          attribution_text?: string | null
          classification: string
          code: string
          created_at?: string
          id?: string
          legal_name: string
          license_identifier?: string | null
          license_url?: string | null
          terms_effective_date?: string | null
          updated_at?: string
        }
        Update: {
          approval_reference?: string
          approval_status?: string
          attribution_text?: string | null
          classification?: string
          code?: string
          created_at?: string
          id?: string
          legal_name?: string
          license_identifier?: string | null
          license_url?: string | null
          terms_effective_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dataset_projection_heads: {
        Row: {
          current_source_release_id: string
          dataset_id: string
          dataset_projection_fingerprint: string
          environment: string
          head_version: number
          id: string
          initial_promotion_receipt_id: string | null
          lifecycle_update_receipt_id: string | null
          previous_head_id: string | null
          updated_at: string
        }
        Insert: {
          current_source_release_id: string
          dataset_id: string
          dataset_projection_fingerprint: string
          environment: string
          head_version: number
          id?: string
          initial_promotion_receipt_id?: string | null
          lifecycle_update_receipt_id?: string | null
          previous_head_id?: string | null
          updated_at?: string
        }
        Update: {
          current_source_release_id?: string
          dataset_id?: string
          dataset_projection_fingerprint?: string
          environment?: string
          head_version?: number
          id?: string
          initial_promotion_receipt_id?: string | null
          lifecycle_update_receipt_id?: string | null
          previous_head_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_projection_heads_current_source_release_id_fkey"
            columns: ["current_source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_projection_heads_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "source_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_projection_heads_initial_promotion_receipt_id_fkey"
            columns: ["initial_promotion_receipt_id"]
            isOneToOne: false
            referencedRelation: "foundation_promotion_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_projection_heads_lifecycle_update_receipt_id_fkey"
            columns: ["lifecycle_update_receipt_id"]
            isOneToOne: false
            referencedRelation: "lifecycle_update_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_projection_heads_previous_head_id_fkey"
            columns: ["previous_head_id"]
            isOneToOne: false
            referencedRelation: "dataset_projection_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_projection_heads_release_dataset_fkey"
            columns: ["current_source_release_id", "dataset_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id", "dataset_id"]
          },
        ]
      }
      food_nutrient_evidence: {
        Row: {
          created_at: string
          derivation_code: string | null
          derivation_description: string | null
          derivation_or_loq_category: string | null
          exact_conversion_factor: number | null
          food_nutrient_id: string
          id: string
          mapping_version_id: string
          original_basis: string
          original_unit: string
          original_value: number | null
          source_nutrient_id: string
          source_record_version_id: string
          source_semantic: string | null
          value_kind: string
        }
        Insert: {
          created_at?: string
          derivation_code?: string | null
          derivation_description?: string | null
          derivation_or_loq_category?: string | null
          exact_conversion_factor?: number | null
          food_nutrient_id: string
          id?: string
          mapping_version_id: string
          original_basis: string
          original_unit: string
          original_value?: number | null
          source_nutrient_id: string
          source_record_version_id: string
          source_semantic?: string | null
          value_kind: string
        }
        Update: {
          created_at?: string
          derivation_code?: string | null
          derivation_description?: string | null
          derivation_or_loq_category?: string | null
          exact_conversion_factor?: number | null
          food_nutrient_id?: string
          id?: string
          mapping_version_id?: string
          original_basis?: string
          original_unit?: string
          original_value?: number | null
          source_nutrient_id?: string
          source_record_version_id?: string
          source_semantic?: string | null
          value_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_nutrient_evidence_mapping_version_id_fkey"
            columns: ["mapping_version_id"]
            isOneToOne: false
            referencedRelation: "nutrient_mapping_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrient_evidence_source_record_version_id_fkey"
            columns: ["source_record_version_id"]
            isOneToOne: false
            referencedRelation: "source_record_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_nutrient_projection_evidence_links: {
        Row: {
          created_at: string
          food_nutrient_evidence_id: string
          food_nutrient_projection_version_id: string
          id: string
        }
        Insert: {
          created_at?: string
          food_nutrient_evidence_id: string
          food_nutrient_projection_version_id: string
          id?: string
        }
        Update: {
          created_at?: string
          food_nutrient_evidence_id?: string
          food_nutrient_projection_version_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_nutrient_projection_evid_food_nutrient_projection_ver_fkey"
            columns: ["food_nutrient_projection_version_id"]
            isOneToOne: true
            referencedRelation: "food_nutrient_projection_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrient_projection_evidenc_food_nutrient_evidence_id_fkey"
            columns: ["food_nutrient_evidence_id"]
            isOneToOne: true
            referencedRelation: "food_nutrient_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      food_nutrient_projection_versions: {
        Row: {
          amount: number | null
          basis: string | null
          created_at: string
          derivation_code: string | null
          derivation_description: string | null
          food_projection_version_id: string
          id: string
          nutrient_code: string
          nutrient_id: string
          projection_hash: string
          projection_state: string
          source_nutrient_id: string | null
          source_semantic: string | null
          source_unit: string | null
        }
        Insert: {
          amount?: number | null
          basis?: string | null
          created_at?: string
          derivation_code?: string | null
          derivation_description?: string | null
          food_projection_version_id: string
          id?: string
          nutrient_code: string
          nutrient_id: string
          projection_hash: string
          projection_state: string
          source_nutrient_id?: string | null
          source_semantic?: string | null
          source_unit?: string | null
        }
        Update: {
          amount?: number | null
          basis?: string | null
          created_at?: string
          derivation_code?: string | null
          derivation_description?: string | null
          food_projection_version_id?: string
          id?: string
          nutrient_code?: string
          nutrient_id?: string
          projection_hash?: string
          projection_state?: string
          source_nutrient_id?: string | null
          source_semantic?: string | null
          source_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_nutrient_projection_versio_food_projection_version_id_fkey"
            columns: ["food_projection_version_id"]
            isOneToOne: false
            referencedRelation: "food_projection_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_portions: {
        Row: {
          amount: number
          created_at: string
          description: string
          gram_weight: number
          id: string
          measure_unit_id: string | null
          measure_unit_name: string | null
          minimum_year_acquired: number | null
          ordinal: number
          qualifier: string | null
          source_portion_id: string | null
          source_record_version_id: string
          source_sequence_number: number | null
          source_value: number | null
          unit: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          gram_weight: number
          id?: string
          measure_unit_id?: string | null
          measure_unit_name?: string | null
          minimum_year_acquired?: number | null
          ordinal: number
          qualifier?: string | null
          source_portion_id?: string | null
          source_record_version_id: string
          source_sequence_number?: number | null
          source_value?: number | null
          unit: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          gram_weight?: number
          id?: string
          measure_unit_id?: string | null
          measure_unit_name?: string | null
          minimum_year_acquired?: number | null
          ordinal?: number
          qualifier?: string | null
          source_portion_id?: string | null
          source_record_version_id?: string
          source_sequence_number?: number | null
          source_value?: number | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_portions_source_record_version_id_fkey"
            columns: ["source_record_version_id"]
            isOneToOne: false
            referencedRelation: "source_record_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_projection_heads: {
        Row: {
          dataset_head_version: number
          dataset_id: string
          dataset_projection_head_id: string
          environment: string
          food_head_version: number
          food_id: string
          food_projection_version_id: string
          id: string
          lifecycle_state: string
          source_record_id: string
          source_record_version_id: string
          updated_at: string
        }
        Insert: {
          dataset_head_version: number
          dataset_id: string
          dataset_projection_head_id: string
          environment: string
          food_head_version: number
          food_id: string
          food_projection_version_id: string
          id?: string
          lifecycle_state: string
          source_record_id: string
          source_record_version_id: string
          updated_at?: string
        }
        Update: {
          dataset_head_version?: number
          dataset_id?: string
          dataset_projection_head_id?: string
          environment?: string
          food_head_version?: number
          food_id?: string
          food_projection_version_id?: string
          id?: string
          lifecycle_state?: string
          source_record_id?: string
          source_record_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_projection_heads_dataset_head_scope_fkey"
            columns: [
              "dataset_projection_head_id",
              "dataset_id",
              "environment",
              "dataset_head_version",
            ]
            isOneToOne: false
            referencedRelation: "dataset_projection_heads"
            referencedColumns: [
              "id",
              "dataset_id",
              "environment",
              "head_version",
            ]
          },
          {
            foreignKeyName: "food_projection_heads_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "source_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_projection_heads_projection_scope_fkey"
            columns: ["food_projection_version_id", "dataset_id", "environment"]
            isOneToOne: false
            referencedRelation: "food_projection_versions"
            referencedColumns: ["id", "dataset_id", "environment"]
          },
          {
            foreignKeyName: "food_projection_heads_record_dataset_fkey"
            columns: ["source_record_id", "dataset_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id", "dataset_id"]
          },
          {
            foreignKeyName: "food_projection_heads_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_projection_heads_source_record_version_id_fkey"
            columns: ["source_record_version_id"]
            isOneToOne: false
            referencedRelation: "source_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_projection_heads_version_record_fkey"
            columns: ["source_record_version_id", "source_record_id"]
            isOneToOne: false
            referencedRelation: "source_record_versions"
            referencedColumns: ["id", "source_record_id"]
          },
        ]
      }
      food_projection_versions: {
        Row: {
          brand_name: string | null
          created_at: string
          data_quality: string
          dataset_id: string
          environment: string
          food_id: string
          food_type: string
          id: string
          initial_promotion_receipt_id: string | null
          is_archived: boolean
          is_public: boolean
          lifecycle_update_receipt_id: string | null
          locale: string
          name: string
          origin_type: string
          prior_food_projection_version_id: string | null
          projection_hash: string
          serving_size: number | null
          serving_unit: string | null
          source_record_id: string
          source_record_version_id: string
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          data_quality: string
          dataset_id: string
          environment: string
          food_id: string
          food_type: string
          id?: string
          initial_promotion_receipt_id?: string | null
          is_archived: boolean
          is_public: boolean
          lifecycle_update_receipt_id?: string | null
          locale: string
          name: string
          origin_type: string
          prior_food_projection_version_id?: string | null
          projection_hash: string
          serving_size?: number | null
          serving_unit?: string | null
          source_record_id: string
          source_record_version_id: string
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          data_quality?: string
          dataset_id?: string
          environment?: string
          food_id?: string
          food_type?: string
          id?: string
          initial_promotion_receipt_id?: string | null
          is_archived?: boolean
          is_public?: boolean
          lifecycle_update_receipt_id?: string | null
          locale?: string
          name?: string
          origin_type?: string
          prior_food_projection_version_id?: string | null
          projection_hash?: string
          serving_size?: number | null
          serving_unit?: string | null
          source_record_id?: string
          source_record_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_projection_versions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "source_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_projection_versions_initial_promotion_receipt_id_fkey"
            columns: ["initial_promotion_receipt_id"]
            isOneToOne: false
            referencedRelation: "foundation_promotion_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_projection_versions_lifecycle_update_receipt_id_fkey"
            columns: ["lifecycle_update_receipt_id"]
            isOneToOne: false
            referencedRelation: "lifecycle_update_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_projection_versions_prior_food_projection_version_id_fkey"
            columns: ["prior_food_projection_version_id"]
            isOneToOne: false
            referencedRelation: "food_projection_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_projection_versions_record_dataset_fkey"
            columns: ["source_record_id", "dataset_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id", "dataset_id"]
          },
          {
            foreignKeyName: "food_projection_versions_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_projection_versions_source_record_version_id_fkey"
            columns: ["source_record_version_id"]
            isOneToOne: false
            referencedRelation: "source_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_projection_versions_version_record_fkey"
            columns: ["source_record_version_id", "source_record_id"]
            isOneToOne: false
            referencedRelation: "source_record_versions"
            referencedColumns: ["id", "source_record_id"]
          },
        ]
      }
      food_source_link_events: {
        Row: {
          created_at: string
          event_fingerprint: string
          event_type: string
          food_id: string
          id: string
          initial_promotion_receipt_id: string | null
          lifecycle_update_receipt_id: string | null
          prior_event_id: string | null
          review_decision_fingerprint: string | null
          source_record_id: string
          source_record_version_id: string
        }
        Insert: {
          created_at?: string
          event_fingerprint: string
          event_type: string
          food_id: string
          id?: string
          initial_promotion_receipt_id?: string | null
          lifecycle_update_receipt_id?: string | null
          prior_event_id?: string | null
          review_decision_fingerprint?: string | null
          source_record_id: string
          source_record_version_id: string
        }
        Update: {
          created_at?: string
          event_fingerprint?: string
          event_type?: string
          food_id?: string
          id?: string
          initial_promotion_receipt_id?: string | null
          lifecycle_update_receipt_id?: string | null
          prior_event_id?: string | null
          review_decision_fingerprint?: string | null
          source_record_id?: string
          source_record_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_source_link_events_initial_promotion_receipt_id_fkey"
            columns: ["initial_promotion_receipt_id"]
            isOneToOne: false
            referencedRelation: "foundation_promotion_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_source_link_events_lifecycle_update_receipt_id_fkey"
            columns: ["lifecycle_update_receipt_id"]
            isOneToOne: false
            referencedRelation: "lifecycle_update_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_source_link_events_prior_event_id_fkey"
            columns: ["prior_event_id"]
            isOneToOne: false
            referencedRelation: "food_source_link_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_source_link_events_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_source_link_events_source_record_version_id_fkey"
            columns: ["source_record_version_id"]
            isOneToOne: false
            referencedRelation: "source_record_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_source_links: {
        Row: {
          created_at: string
          effective_import_run_id: string | null
          food_id: string
          id: string
          link_role: string
          review_reason: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_record_id: string
        }
        Insert: {
          created_at?: string
          effective_import_run_id?: string | null
          food_id: string
          id?: string
          link_role: string
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_record_id: string
        }
        Update: {
          created_at?: string
          effective_import_run_id?: string | null
          food_id?: string
          id?: string
          link_role?: string
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_source_links_effective_import_run_id_fkey"
            columns: ["effective_import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_source_links_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      foundation_promotion_approvals: {
        Row: {
          approval_contract: Json
          approval_fingerprint: string
          approval_reference: string
          approval_timestamp: string
          approver_identity: string
          created_at: string
          expires_at: string | null
          id: string
          promotion_policy_version: string
          reject_allowance_id: string | null
          target_environment: string
          validation_receipt_id: string
        }
        Insert: {
          approval_contract: Json
          approval_fingerprint: string
          approval_reference: string
          approval_timestamp: string
          approver_identity: string
          created_at?: string
          expires_at?: string | null
          id?: string
          promotion_policy_version: string
          reject_allowance_id?: string | null
          target_environment: string
          validation_receipt_id: string
        }
        Update: {
          approval_contract?: Json
          approval_fingerprint?: string
          approval_reference?: string
          approval_timestamp?: string
          approver_identity?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          promotion_policy_version?: string
          reject_allowance_id?: string | null
          target_environment?: string
          validation_receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foundation_promotion_approvals_reject_allowance_id_fkey"
            columns: ["reject_allowance_id"]
            isOneToOne: false
            referencedRelation: "foundation_reject_allowances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foundation_promotion_approvals_validation_receipt_id_fkey"
            columns: ["validation_receipt_id"]
            isOneToOne: true
            referencedRelation: "foundation_validation_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      foundation_promotion_receipts: {
        Row: {
          accepted_set_fingerprint: string
          completion_timestamp: string
          created_at: string
          id: string
          import_run_id: string
          inserted_food_count: number
          inserted_link_count: number
          inserted_nutrient_count: number
          inserted_portion_count: number
          inserted_source_record_count: number
          inserted_version_count: number
          manifest_fingerprint: string
          mapping_hash: string
          mapping_version: string
          promotion_approval_id: string
          promotion_policy_version: string
          receipt_fingerprint: string
          rejected_set_fingerprint: string
          source_release_id: string
          validation_receipt_fingerprint: string
        }
        Insert: {
          accepted_set_fingerprint: string
          completion_timestamp: string
          created_at?: string
          id?: string
          import_run_id: string
          inserted_food_count: number
          inserted_link_count: number
          inserted_nutrient_count: number
          inserted_portion_count: number
          inserted_source_record_count: number
          inserted_version_count: number
          manifest_fingerprint: string
          mapping_hash: string
          mapping_version: string
          promotion_approval_id: string
          promotion_policy_version: string
          receipt_fingerprint: string
          rejected_set_fingerprint: string
          source_release_id: string
          validation_receipt_fingerprint: string
        }
        Update: {
          accepted_set_fingerprint?: string
          completion_timestamp?: string
          created_at?: string
          id?: string
          import_run_id?: string
          inserted_food_count?: number
          inserted_link_count?: number
          inserted_nutrient_count?: number
          inserted_portion_count?: number
          inserted_source_record_count?: number
          inserted_version_count?: number
          manifest_fingerprint?: string
          mapping_hash?: string
          mapping_version?: string
          promotion_approval_id?: string
          promotion_policy_version?: string
          receipt_fingerprint?: string
          rejected_set_fingerprint?: string
          source_release_id?: string
          validation_receipt_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "foundation_promotion_receipts_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: true
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foundation_promotion_receipts_promotion_approval_id_fkey"
            columns: ["promotion_approval_id"]
            isOneToOne: true
            referencedRelation: "foundation_promotion_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foundation_promotion_receipts_source_release_id_fkey"
            columns: ["source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      foundation_reject_allowances: {
        Row: {
          accepted_count: number
          accepted_set_fingerprint: string
          allowance_contract: Json
          allowance_fingerprint: string
          approval_date: string
          approval_reference: string
          created_at: string
          data_governance_approver: string
          expires_on: string | null
          id: string
          manifest_fingerprint: string
          reject_category_counts: Json
          rejected_count: number
          rejected_set_fingerprint: string
          report_fingerprint: string
          source_count: number
          source_release_identity: string
          target_environment: string
        }
        Insert: {
          accepted_count: number
          accepted_set_fingerprint: string
          allowance_contract: Json
          allowance_fingerprint: string
          approval_date: string
          approval_reference: string
          created_at?: string
          data_governance_approver: string
          expires_on?: string | null
          id?: string
          manifest_fingerprint: string
          reject_category_counts: Json
          rejected_count: number
          rejected_set_fingerprint: string
          report_fingerprint: string
          source_count: number
          source_release_identity: string
          target_environment: string
        }
        Update: {
          accepted_count?: number
          accepted_set_fingerprint?: string
          allowance_contract?: Json
          allowance_fingerprint?: string
          approval_date?: string
          approval_reference?: string
          created_at?: string
          data_governance_approver?: string
          expires_on?: string | null
          id?: string
          manifest_fingerprint?: string
          reject_category_counts?: Json
          rejected_count?: number
          rejected_set_fingerprint?: string
          report_fingerprint?: string
          source_count?: number
          source_release_identity?: string
          target_environment?: string
        }
        Relationships: []
      }
      foundation_validation_receipts: {
        Row: {
          accepted_count: number
          accepted_set_fingerprint: string
          created_at: string
          id: string
          import_run_id: string
          importer_contract_version: string
          manifest_fingerprint: string
          mapping_hash: string
          mapping_version: string
          receipt_fingerprint: string
          reject_allowance_id: string | null
          reject_category_counts: Json
          reject_policy_version: string
          rejected_count: number
          rejected_set_fingerprint: string
          report_fingerprint: string
          schema_contract_hash: string
          schema_contract_version: string
          source_count: number
          source_release_id: string
          target_environment: string
          warning_count: number
          warning_set_fingerprint: string
        }
        Insert: {
          accepted_count: number
          accepted_set_fingerprint: string
          created_at?: string
          id?: string
          import_run_id: string
          importer_contract_version: string
          manifest_fingerprint: string
          mapping_hash: string
          mapping_version: string
          receipt_fingerprint: string
          reject_allowance_id?: string | null
          reject_category_counts: Json
          reject_policy_version: string
          rejected_count: number
          rejected_set_fingerprint: string
          report_fingerprint: string
          schema_contract_hash: string
          schema_contract_version: string
          source_count: number
          source_release_id: string
          target_environment: string
          warning_count: number
          warning_set_fingerprint: string
        }
        Update: {
          accepted_count?: number
          accepted_set_fingerprint?: string
          created_at?: string
          id?: string
          import_run_id?: string
          importer_contract_version?: string
          manifest_fingerprint?: string
          mapping_hash?: string
          mapping_version?: string
          receipt_fingerprint?: string
          reject_allowance_id?: string | null
          reject_category_counts?: Json
          reject_policy_version?: string
          rejected_count?: number
          rejected_set_fingerprint?: string
          report_fingerprint?: string
          schema_contract_hash?: string
          schema_contract_version?: string
          source_count?: number
          source_release_id?: string
          target_environment?: string
          warning_count?: number
          warning_set_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "foundation_validation_receipts_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: true
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foundation_validation_receipts_reject_allowance_id_fkey"
            columns: ["reject_allowance_id"]
            isOneToOne: false
            referencedRelation: "foundation_reject_allowances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foundation_validation_receipts_source_release_id_fkey"
            columns: ["source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      import_run_events: {
        Row: {
          event_at: string
          event_sequence: number
          failure_category: string | null
          id: string
          import_run_id: string
          next_state: string
          operator_execution_identity: string
          previous_state: string | null
          reason: string | null
        }
        Insert: {
          event_at?: string
          event_sequence: number
          failure_category?: string | null
          id?: string
          import_run_id: string
          next_state: string
          operator_execution_identity: string
          previous_state?: string | null
          reason?: string | null
        }
        Update: {
          event_at?: string
          event_sequence?: number
          failure_category?: string | null
          id?: string
          import_run_id?: string
          next_state?: string
          operator_execution_identity?: string
          previous_state?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_run_events_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_run_items: {
        Row: {
          action: string
          category: string | null
          created_at: string
          evidence_reference: string | null
          id: string
          import_run_id: string
          outcome: string
          source_record_version_id: string | null
          source_row_key: string
        }
        Insert: {
          action: string
          category?: string | null
          created_at?: string
          evidence_reference?: string | null
          id?: string
          import_run_id: string
          outcome: string
          source_record_version_id?: string | null
          source_row_key: string
        }
        Update: {
          action?: string
          category?: string | null
          created_at?: string
          evidence_reference?: string | null
          id?: string
          import_run_id?: string
          outcome?: string
          source_record_version_id?: string | null
          source_row_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_run_items_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_run_items_source_record_version_id_fkey"
            columns: ["source_record_version_id"]
            isOneToOne: false
            referencedRelation: "source_record_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          accepted_count: number
          approval_reference: string
          archived_count: number
          artifact_reference: string | null
          attempt_number: number
          completed_at: string | null
          created_at: string
          current_state: string
          derived_definition_version: string | null
          diff_contract_version: string | null
          failure_category: string | null
          id: string
          importer_contract_version: string
          inserted_count: number
          lifecycle_environment: string | null
          lifecycle_policy_version: string | null
          logical_run_fingerprint: string
          nutrient_mapping_version_id: string | null
          operator_execution_identity: string
          parser_contract_version: string | null
          previous_failed_attempt_id: string | null
          prior_dataset_projection_fingerprint: string | null
          prior_dataset_projection_head_id: string | null
          rejected_count: number
          run_purpose: string
          source_count: number
          source_release_id: string
          started_at: string
          unchanged_count: number
          updated_at: string
          updated_count: number
          warning_count: number
        }
        Insert: {
          accepted_count?: number
          approval_reference: string
          archived_count?: number
          artifact_reference?: string | null
          attempt_number: number
          completed_at?: string | null
          created_at?: string
          current_state?: string
          derived_definition_version?: string | null
          diff_contract_version?: string | null
          failure_category?: string | null
          id?: string
          importer_contract_version: string
          inserted_count?: number
          lifecycle_environment?: string | null
          lifecycle_policy_version?: string | null
          logical_run_fingerprint: string
          nutrient_mapping_version_id?: string | null
          operator_execution_identity: string
          parser_contract_version?: string | null
          previous_failed_attempt_id?: string | null
          prior_dataset_projection_fingerprint?: string | null
          prior_dataset_projection_head_id?: string | null
          rejected_count?: number
          run_purpose: string
          source_count?: number
          source_release_id: string
          started_at?: string
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
          warning_count?: number
        }
        Update: {
          accepted_count?: number
          approval_reference?: string
          archived_count?: number
          artifact_reference?: string | null
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          current_state?: string
          derived_definition_version?: string | null
          diff_contract_version?: string | null
          failure_category?: string | null
          id?: string
          importer_contract_version?: string
          inserted_count?: number
          lifecycle_environment?: string | null
          lifecycle_policy_version?: string | null
          logical_run_fingerprint?: string
          nutrient_mapping_version_id?: string | null
          operator_execution_identity?: string
          parser_contract_version?: string | null
          previous_failed_attempt_id?: string | null
          prior_dataset_projection_fingerprint?: string | null
          prior_dataset_projection_head_id?: string | null
          rejected_count?: number
          run_purpose?: string
          source_count?: number
          source_release_id?: string
          started_at?: string
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_nutrient_mapping_version_id_fkey"
            columns: ["nutrient_mapping_version_id"]
            isOneToOne: false
            referencedRelation: "nutrient_mapping_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_runs_previous_failed_attempt_id_fkey"
            columns: ["previous_failed_attempt_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_runs_prior_dataset_projection_head_fkey"
            columns: [
              "prior_dataset_projection_head_id",
              "lifecycle_environment",
              "prior_dataset_projection_fingerprint",
            ]
            isOneToOne: false
            referencedRelation: "dataset_projection_heads"
            referencedColumns: [
              "id",
              "environment",
              "dataset_projection_fingerprint",
            ]
          },
          {
            foreignKeyName: "import_runs_source_release_id_fkey"
            columns: ["source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_allowances: {
        Row: {
          allowance_type: string
          allowed_lifecycle_action: string
          approval_reference: string
          approval_timestamp: string
          approver_identity: string
          contract_fingerprint: string
          contract_json: Json
          created_at: string
          dataset_id: string
          environment: string
          exact_item_fingerprints: Json
          exact_set_fingerprint: string
          expires_at: string
          id: string
          policy_version: string
          prior_dataset_projection_head_id: string
          source_release_id: string
        }
        Insert: {
          allowance_type: string
          allowed_lifecycle_action: string
          approval_reference: string
          approval_timestamp: string
          approver_identity: string
          contract_fingerprint: string
          contract_json: Json
          created_at?: string
          dataset_id: string
          environment: string
          exact_item_fingerprints: Json
          exact_set_fingerprint: string
          expires_at: string
          id?: string
          policy_version: string
          prior_dataset_projection_head_id: string
          source_release_id: string
        }
        Update: {
          allowance_type?: string
          allowed_lifecycle_action?: string
          approval_reference?: string
          approval_timestamp?: string
          approver_identity?: string
          contract_fingerprint?: string
          contract_json?: Json
          created_at?: string
          dataset_id?: string
          environment?: string
          exact_item_fingerprints?: Json
          exact_set_fingerprint?: string
          expires_at?: string
          id?: string
          policy_version?: string
          prior_dataset_projection_head_id?: string
          source_release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_allowances_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "source_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_allowances_head_scope_fkey"
            columns: [
              "prior_dataset_projection_head_id",
              "dataset_id",
              "environment",
            ]
            isOneToOne: false
            referencedRelation: "dataset_projection_heads"
            referencedColumns: ["id", "dataset_id", "environment"]
          },
          {
            foreignKeyName: "lifecycle_allowances_prior_dataset_projection_head_id_fkey"
            columns: ["prior_dataset_projection_head_id"]
            isOneToOne: false
            referencedRelation: "dataset_projection_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_allowances_release_dataset_fkey"
            columns: ["source_release_id", "dataset_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id", "dataset_id"]
          },
          {
            foreignKeyName: "lifecycle_allowances_source_release_id_fkey"
            columns: ["source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_update_approvals: {
        Row: {
          approval_contract: Json
          approval_fingerprint: string
          approval_reference: string
          approval_timestamp: string
          approver_identity: string
          created_at: string
          environment: string
          expires_at: string
          id: string
          policy_version: string
          validation_receipt_id: string
        }
        Insert: {
          approval_contract: Json
          approval_fingerprint: string
          approval_reference: string
          approval_timestamp: string
          approver_identity: string
          created_at?: string
          environment: string
          expires_at: string
          id?: string
          policy_version: string
          validation_receipt_id: string
        }
        Update: {
          approval_contract?: Json
          approval_fingerprint?: string
          approval_reference?: string
          approval_timestamp?: string
          approver_identity?: string
          created_at?: string
          environment?: string
          expires_at?: string
          id?: string
          policy_version?: string
          validation_receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_update_approvals_validation_receipt_id_fkey"
            columns: ["validation_receipt_id"]
            isOneToOne: true
            referencedRelation: "lifecycle_validation_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_update_receipts: {
        Row: {
          completion_timestamp: string
          created_at: string
          environment: string
          id: string
          import_run_id: string
          lifecycle_update_approval_id: string
          prior_dataset_projection_head_id: string
          receipt_contract: Json
          receipt_fingerprint: string
          resulting_dataset_projection_head_id: string
        }
        Insert: {
          completion_timestamp: string
          created_at?: string
          environment: string
          id?: string
          import_run_id: string
          lifecycle_update_approval_id: string
          prior_dataset_projection_head_id: string
          receipt_contract: Json
          receipt_fingerprint: string
          resulting_dataset_projection_head_id: string
        }
        Update: {
          completion_timestamp?: string
          created_at?: string
          environment?: string
          id?: string
          import_run_id?: string
          lifecycle_update_approval_id?: string
          prior_dataset_projection_head_id?: string
          receipt_contract?: Json
          receipt_fingerprint?: string
          resulting_dataset_projection_head_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_update_receipts_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: true
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_update_receipts_lifecycle_update_approval_id_fkey"
            columns: ["lifecycle_update_approval_id"]
            isOneToOne: true
            referencedRelation: "lifecycle_update_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_update_receipts_prior_head_fkey"
            columns: ["prior_dataset_projection_head_id", "environment"]
            isOneToOne: false
            referencedRelation: "dataset_projection_heads"
            referencedColumns: ["id", "environment"]
          },
          {
            foreignKeyName: "lifecycle_update_receipts_resulting_head_fkey"
            columns: ["resulting_dataset_projection_head_id", "environment"]
            isOneToOne: false
            referencedRelation: "dataset_projection_heads"
            referencedColumns: ["id", "environment"]
          },
        ]
      }
      lifecycle_validation_receipts: {
        Row: {
          created_at: string
          environment: string
          id: string
          import_run_id: string
          prior_dataset_projection_head_id: string
          release_diff_report_id: string | null
          release_scope_evidence_id: string
          validation_contract: Json
          validation_fingerprint: string
        }
        Insert: {
          created_at?: string
          environment: string
          id?: string
          import_run_id: string
          prior_dataset_projection_head_id: string
          release_diff_report_id?: string | null
          release_scope_evidence_id: string
          validation_contract: Json
          validation_fingerprint: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          import_run_id?: string
          prior_dataset_projection_head_id?: string
          release_diff_report_id?: string | null
          release_scope_evidence_id?: string
          validation_contract?: Json
          validation_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_validation_receipts_diff_report_fkey"
            columns: ["release_diff_report_id"]
            isOneToOne: false
            referencedRelation: "release_diff_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_validation_receipts_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: true
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_validation_receipts_prior_head_fkey"
            columns: ["prior_dataset_projection_head_id", "environment"]
            isOneToOne: false
            referencedRelation: "dataset_projection_heads"
            referencedColumns: ["id", "environment"]
          },
          {
            foreignKeyName: "lifecycle_validation_receipts_release_scope_evidence_id_fkey"
            columns: ["release_scope_evidence_id"]
            isOneToOne: false
            referencedRelation: "release_scope_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrient_mapping_versions: {
        Row: {
          approval_reference: string | null
          approval_status: string
          approved_at: string | null
          content_sha256: string
          created_at: string
          dataset_id: string
          id: string
          mapping_owner: string
          version_code: string
        }
        Insert: {
          approval_reference?: string | null
          approval_status?: string
          approved_at?: string | null
          content_sha256: string
          created_at?: string
          dataset_id: string
          id?: string
          mapping_owner: string
          version_code: string
        }
        Update: {
          approval_reference?: string | null
          approval_status?: string
          approved_at?: string | null
          content_sha256?: string
          created_at?: string
          dataset_id?: string
          id?: string
          mapping_owner?: string
          version_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_mapping_versions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "source_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrient_source_mappings: {
        Row: {
          application_nutrient_id: string | null
          application_unit: string | null
          conversion_classification: string
          created_at: string
          exact_conversion_factor: number | null
          explicit_zero_policy: string
          id: string
          mapping_status: string
          mapping_version_id: string
          missing_value_policy: string
          review_notes: string | null
          source_basis: string
          source_nutrient_id: string
          source_nutrient_name: string
          source_unit: string
          value_classification: string
        }
        Insert: {
          application_nutrient_id?: string | null
          application_unit?: string | null
          conversion_classification: string
          created_at?: string
          exact_conversion_factor?: number | null
          explicit_zero_policy: string
          id?: string
          mapping_status: string
          mapping_version_id: string
          missing_value_policy: string
          review_notes?: string | null
          source_basis: string
          source_nutrient_id: string
          source_nutrient_name: string
          source_unit: string
          value_classification: string
        }
        Update: {
          application_nutrient_id?: string | null
          application_unit?: string | null
          conversion_classification?: string
          created_at?: string
          exact_conversion_factor?: number | null
          explicit_zero_policy?: string
          id?: string
          mapping_status?: string
          mapping_version_id?: string
          missing_value_policy?: string
          review_notes?: string | null
          source_basis?: string
          source_nutrient_id?: string
          source_nutrient_name?: string
          source_unit?: string
          value_classification?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_source_mappings_mapping_version_id_fkey"
            columns: ["mapping_version_id"]
            isOneToOne: false
            referencedRelation: "nutrient_mapping_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_decision_items: {
        Row: {
          created_at: string
          diff_item_fingerprint: string | null
          food_id: string | null
          id: string
          item_fingerprint: string
          item_ordinal: number
          reconciliation_decision_id: string
          related_source_record_id: string | null
          source_record_id: string | null
          source_record_version_id: string | null
        }
        Insert: {
          created_at?: string
          diff_item_fingerprint?: string | null
          food_id?: string | null
          id?: string
          item_fingerprint: string
          item_ordinal: number
          reconciliation_decision_id: string
          related_source_record_id?: string | null
          source_record_id?: string | null
          source_record_version_id?: string | null
        }
        Update: {
          created_at?: string
          diff_item_fingerprint?: string | null
          food_id?: string | null
          id?: string
          item_fingerprint?: string
          item_ordinal?: number
          reconciliation_decision_id?: string
          related_source_record_id?: string | null
          source_record_id?: string | null
          source_record_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_decision_items_reconciliation_decision_id_fkey"
            columns: ["reconciliation_decision_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_decision_items_related_source_record_id_fkey"
            columns: ["related_source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_decision_items_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_decision_items_source_record_version_id_fkey"
            columns: ["source_record_version_id"]
            isOneToOne: false
            referencedRelation: "source_record_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_decisions: {
        Row: {
          approval_reference: string
          approval_timestamp: string
          contract_fingerprint: string
          contract_json: Json
          created_at: string
          dataset_id: string
          decision_type: string
          environment: string
          expires_at: string | null
          id: string
          policy_version: string
          relationship_direction: string
          reviewer_identity: string
          source_release_id: string
          supersedes_decision_id: string | null
        }
        Insert: {
          approval_reference: string
          approval_timestamp: string
          contract_fingerprint: string
          contract_json: Json
          created_at?: string
          dataset_id: string
          decision_type: string
          environment: string
          expires_at?: string | null
          id?: string
          policy_version: string
          relationship_direction: string
          reviewer_identity: string
          source_release_id: string
          supersedes_decision_id?: string | null
        }
        Update: {
          approval_reference?: string
          approval_timestamp?: string
          contract_fingerprint?: string
          contract_json?: Json
          created_at?: string
          dataset_id?: string
          decision_type?: string
          environment?: string
          expires_at?: string | null
          id?: string
          policy_version?: string
          relationship_direction?: string
          reviewer_identity?: string
          source_release_id?: string
          supersedes_decision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_decisions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "source_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_decisions_release_dataset_fkey"
            columns: ["source_release_id", "dataset_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id", "dataset_id"]
          },
          {
            foreignKeyName: "reconciliation_decisions_source_release_id_fkey"
            columns: ["source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_decisions_supersedes_decision_id_fkey"
            columns: ["supersedes_decision_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      release_diff_items: {
        Row: {
          concept_key: string | null
          created_at: string
          id: string
          item_fingerprint: string
          normalized_candidate_hash: string | null
          prior_public_projection_hash: string | null
          prior_source_version_hash: string | null
          proposed_public_projection_hash: string | null
          raw_payload_hash: string | null
          reason_category: string | null
          reconciliation_decision_fingerprint: string | null
          release_diff_report_id: string
          set_classification: string
          set_ordinal: number
          source_row_key: string | null
          upstream_version_key: string | null
        }
        Insert: {
          concept_key?: string | null
          created_at?: string
          id?: string
          item_fingerprint: string
          normalized_candidate_hash?: string | null
          prior_public_projection_hash?: string | null
          prior_source_version_hash?: string | null
          proposed_public_projection_hash?: string | null
          raw_payload_hash?: string | null
          reason_category?: string | null
          reconciliation_decision_fingerprint?: string | null
          release_diff_report_id: string
          set_classification: string
          set_ordinal: number
          source_row_key?: string | null
          upstream_version_key?: string | null
        }
        Update: {
          concept_key?: string | null
          created_at?: string
          id?: string
          item_fingerprint?: string
          normalized_candidate_hash?: string | null
          prior_public_projection_hash?: string | null
          prior_source_version_hash?: string | null
          proposed_public_projection_hash?: string | null
          raw_payload_hash?: string | null
          reason_category?: string | null
          reconciliation_decision_fingerprint?: string | null
          release_diff_report_id?: string
          set_classification?: string
          set_ordinal?: number
          source_row_key?: string | null
          upstream_version_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "release_diff_items_release_diff_report_id_fkey"
            columns: ["release_diff_report_id"]
            isOneToOne: false
            referencedRelation: "release_diff_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      release_diff_reports: {
        Row: {
          before_projection_fingerprint: string
          category_counts: Json
          contract_versions: Json
          created_at: string
          environment: string
          exact_set_counts: Json
          exact_set_fingerprints: Json
          id: string
          import_run_id: string
          new_source_release_id: string
          prior_dataset_projection_head_id: string
          prior_source_release_id: string
          proposed_projection_fingerprint: string
          release_scope_evidence_id: string
          report_fingerprint: string
        }
        Insert: {
          before_projection_fingerprint: string
          category_counts: Json
          contract_versions: Json
          created_at?: string
          environment: string
          exact_set_counts: Json
          exact_set_fingerprints: Json
          id?: string
          import_run_id: string
          new_source_release_id: string
          prior_dataset_projection_head_id: string
          prior_source_release_id: string
          proposed_projection_fingerprint: string
          release_scope_evidence_id: string
          report_fingerprint: string
        }
        Update: {
          before_projection_fingerprint?: string
          category_counts?: Json
          contract_versions?: Json
          created_at?: string
          environment?: string
          exact_set_counts?: Json
          exact_set_fingerprints?: Json
          id?: string
          import_run_id?: string
          new_source_release_id?: string
          prior_dataset_projection_head_id?: string
          prior_source_release_id?: string
          proposed_projection_fingerprint?: string
          release_scope_evidence_id?: string
          report_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_diff_reports_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: true
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_diff_reports_new_source_release_id_fkey"
            columns: ["new_source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_diff_reports_prior_dataset_projection_head_id_fkey"
            columns: ["prior_dataset_projection_head_id"]
            isOneToOne: false
            referencedRelation: "dataset_projection_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_diff_reports_prior_source_release_id_fkey"
            columns: ["prior_source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_diff_reports_release_scope_evidence_id_fkey"
            columns: ["release_scope_evidence_id"]
            isOneToOne: false
            referencedRelation: "release_scope_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      release_scope_evidence: {
        Row: {
          approval_reference: string
          approval_timestamp: string
          archive_sha256: string
          artifact_kind: string
          contract_fingerprint: string
          contract_json: Json
          created_at: string
          dataset_id: string
          environment: string
          evidence_references: Json
          expires_at: string | null
          id: string
          manifest_fingerprint: string
          policy_version: string
          reviewer_identity: string
          scope_classification: string
          source_release_id: string
          supersedes_scope_evidence_id: string | null
        }
        Insert: {
          approval_reference: string
          approval_timestamp: string
          archive_sha256: string
          artifact_kind: string
          contract_fingerprint: string
          contract_json: Json
          created_at?: string
          dataset_id: string
          environment: string
          evidence_references: Json
          expires_at?: string | null
          id?: string
          manifest_fingerprint: string
          policy_version: string
          reviewer_identity: string
          scope_classification: string
          source_release_id: string
          supersedes_scope_evidence_id?: string | null
        }
        Update: {
          approval_reference?: string
          approval_timestamp?: string
          archive_sha256?: string
          artifact_kind?: string
          contract_fingerprint?: string
          contract_json?: Json
          created_at?: string
          dataset_id?: string
          environment?: string
          evidence_references?: Json
          expires_at?: string | null
          id?: string
          manifest_fingerprint?: string
          policy_version?: string
          reviewer_identity?: string
          scope_classification?: string
          source_release_id?: string
          supersedes_scope_evidence_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "release_scope_evidence_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "source_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_scope_evidence_release_dataset_fkey"
            columns: ["source_release_id", "dataset_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id", "dataset_id"]
          },
          {
            foreignKeyName: "release_scope_evidence_source_release_id_fkey"
            columns: ["source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_scope_evidence_supersedes_scope_evidence_id_fkey"
            columns: ["supersedes_scope_evidence_id"]
            isOneToOne: false
            referencedRelation: "release_scope_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      source_datasets: {
        Row: {
          approval_status: string
          authorized_url_prefix: string
          code: string
          created_at: string
          data_source_id: string
          data_type: string
          expected_cadence: string
          id: string
          identity_scheme: string
          name: string
          schema_contract_family: string
          updated_at: string
        }
        Insert: {
          approval_status: string
          authorized_url_prefix: string
          code: string
          created_at?: string
          data_source_id: string
          data_type: string
          expected_cadence: string
          id?: string
          identity_scheme: string
          name: string
          schema_contract_family: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          authorized_url_prefix?: string
          code?: string
          created_at?: string
          data_source_id?: string
          data_type?: string
          expected_cadence?: string
          id?: string
          identity_scheme?: string
          name?: string
          schema_contract_family?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_datasets_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_distributors: {
        Row: {
          approval_status: string
          authorized_url_prefix: string
          code: string
          created_at: string
          delivery_kind: string
          id: string
          name: string
          organization_source_id: string | null
          updated_at: string
        }
        Insert: {
          approval_status: string
          authorized_url_prefix: string
          code: string
          created_at?: string
          delivery_kind: string
          id?: string
          name: string
          organization_source_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          authorized_url_prefix?: string
          code?: string
          created_at?: string
          delivery_kind?: string
          id?: string
          name?: string
          organization_source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_distributors_organization_source_id_fkey"
            columns: ["organization_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_record_versions: {
        Row: {
          content_sha256: string
          created_at: string
          effective_date: string | null
          id: string
          publication_date: string | null
          raw_evidence_reference: string | null
          source_record_id: string
          source_release_id: string
          source_status: string
          upstream_version_key: string
        }
        Insert: {
          content_sha256: string
          created_at?: string
          effective_date?: string | null
          id?: string
          publication_date?: string | null
          raw_evidence_reference?: string | null
          source_record_id: string
          source_release_id: string
          source_status: string
          upstream_version_key: string
        }
        Update: {
          content_sha256?: string
          created_at?: string
          effective_date?: string | null
          id?: string
          publication_date?: string | null
          raw_evidence_reference?: string | null
          source_record_id?: string
          source_release_id?: string
          source_status?: string
          upstream_version_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_record_versions_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_record_versions_source_release_id_fkey"
            columns: ["source_release_id"]
            isOneToOne: false
            referencedRelation: "source_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      source_records: {
        Row: {
          concept_key: string
          created_at: string
          dataset_id: string
          id: string
          lifecycle_status: string
          updated_at: string
        }
        Insert: {
          concept_key: string
          created_at?: string
          dataset_id: string
          id?: string
          lifecycle_status?: string
          updated_at?: string
        }
        Update: {
          concept_key?: string
          created_at?: string
          dataset_id?: string
          id?: string
          lifecycle_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_records_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "source_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      source_releases: {
        Row: {
          acquisition_method: string
          approval_reference: string
          archive_name: string
          authorized_delivery_url: string
          compressed_size: number
          created_at: string
          dataset_id: string
          distributor_id: string
          file_format: string
          id: string
          license_identifier: string
          manifest_contract_version: string
          manifest_fingerprint: string
          official_url: string
          original_release_identifier: string
          publication_date: string
          reject_policy_version: string | null
          required_attribution: string
          schema_contract_version: string
          sha256: string
          transformation_id: string | null
          transformation_release_identifier: string | null
          uncompressed_size: number
        }
        Insert: {
          acquisition_method: string
          approval_reference: string
          archive_name: string
          authorized_delivery_url: string
          compressed_size: number
          created_at?: string
          dataset_id: string
          distributor_id: string
          file_format: string
          id?: string
          license_identifier: string
          manifest_contract_version: string
          manifest_fingerprint: string
          official_url: string
          original_release_identifier: string
          publication_date: string
          reject_policy_version?: string | null
          required_attribution: string
          schema_contract_version: string
          sha256: string
          transformation_id?: string | null
          transformation_release_identifier?: string | null
          uncompressed_size: number
        }
        Update: {
          acquisition_method?: string
          approval_reference?: string
          archive_name?: string
          authorized_delivery_url?: string
          compressed_size?: number
          created_at?: string
          dataset_id?: string
          distributor_id?: string
          file_format?: string
          id?: string
          license_identifier?: string
          manifest_contract_version?: string
          manifest_fingerprint?: string
          official_url?: string
          original_release_identifier?: string
          publication_date?: string
          reject_policy_version?: string | null
          required_attribution?: string
          schema_contract_version?: string
          sha256?: string
          transformation_id?: string | null
          transformation_release_identifier?: string | null
          uncompressed_size?: number
        }
        Relationships: [
          {
            foreignKeyName: "source_releases_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "source_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_releases_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "source_distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_releases_transformation_id_fkey"
            columns: ["transformation_id"]
            isOneToOne: false
            referencedRelation: "source_transformations"
            referencedColumns: ["id"]
          },
        ]
      }
      source_transformations: {
        Row: {
          approval_status: string
          code: string
          content_contract_sha256: string | null
          contract_version: string
          created_at: string
          documentation_url: string
          id: string
          name: string
          transformer_source_id: string
        }
        Insert: {
          approval_status: string
          code: string
          content_contract_sha256?: string | null
          contract_version: string
          created_at?: string
          documentation_url: string
          id?: string
          name: string
          transformer_source_id: string
        }
        Update: {
          approval_status?: string
          code?: string
          content_contract_sha256?: string | null
          contract_version?: string
          created_at?: string
          documentation_url?: string
          id?: string
          name?: string
          transformer_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_transformations_transformer_source_id_fkey"
            columns: ["transformer_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      staged_candidates: {
        Row: {
          concept_key: string | null
          created_at: string
          expires_at: string
          id: string
          import_run_id: string
          normalized_candidate: Json
          normalized_content_sha256: string
          reject_category: string | null
          source_row_key: string
          staged_source_record_id: string
          upstream_version_key: string | null
          validation_status: string
          warning_count: number
        }
        Insert: {
          concept_key?: string | null
          created_at?: string
          expires_at: string
          id?: string
          import_run_id: string
          normalized_candidate: Json
          normalized_content_sha256: string
          reject_category?: string | null
          source_row_key: string
          staged_source_record_id: string
          upstream_version_key?: string | null
          validation_status: string
          warning_count?: number
        }
        Update: {
          concept_key?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          import_run_id?: string
          normalized_candidate?: Json
          normalized_content_sha256?: string
          reject_category?: string | null
          source_row_key?: string
          staged_source_record_id?: string
          upstream_version_key?: string | null
          validation_status?: string
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "staged_candidates_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staged_candidates_staged_source_record_id_fkey"
            columns: ["staged_source_record_id"]
            isOneToOne: true
            referencedRelation: "staged_source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      staged_source_records: {
        Row: {
          expires_at: string
          id: string
          import_run_id: string
          payload_sha256: string
          raw_payload: Json
          source_row_key: string
          staged_at: string
        }
        Insert: {
          expires_at: string
          id?: string
          import_run_id: string
          payload_sha256: string
          raw_payload: Json
          source_row_key: string
          staged_at?: string
        }
        Update: {
          expires_at?: string
          id?: string
          import_run_id?: string
          payload_sha256?: string
          raw_payload?: Json
          source_row_key?: string
          staged_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staged_source_records_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_foundation_promotion: {
        Args: { p_approval: Json; p_validation_receipt_id: string }
        Returns: {
          approval_fingerprint: string
          promotion_approval_id: string
        }[]
      }
      assert_exact_json_fields: {
        Args: { p_expected_keys: string[]; p_max_bytes: number; p_value: Json }
        Returns: undefined
      }
      begin_import_run: {
        Args: {
          p_approval_reference: string
          p_derived_definition_version?: string
          p_importer_contract_version: string
          p_logical_run_fingerprint: string
          p_nutrient_mapping_version_code?: string
          p_operator_execution_identity: string
          p_previous_failed_attempt_id?: string
          p_source_release_id: string
        }
        Returns: {
          attempt_number: number
          current_state: string
          import_run_id: string
        }[]
      }
      bootstrap_foundation_lifecycle_baseline: {
        Args: { p_initial_promotion_receipt_id: string }
        Returns: {
          dataset_projection_fingerprint: string
          dataset_projection_head_id: string
          evidence_link_count: number
          exact_retry: boolean
          food_count: number
          missing_nutrient_count: number
          present_nutrient_count: number
        }[]
      }
      canonicalize_json_v1: { Args: { p_value: Json }; Returns: string }
      canonicalize_source_release_manifest_v1: {
        Args: { p_manifest: Json }
        Returns: string
      }
      cleanup_expired_staging: {
        Args: never
        Returns: {
          deleted_candidates: number
          deleted_source_records: number
        }[]
      }
      create_foundation_lifecycle_run: {
        Args: {
          p_approval_reference: string
          p_diff_contract_version: string
          p_environment: string
          p_importer_contract_version: string
          p_lifecycle_policy_version: string
          p_logical_run_fingerprint: string
          p_nutrient_mapping_version_code: string
          p_operator_execution_identity: string
          p_parser_contract_version: string
          p_previous_failed_attempt_id?: string
          p_prior_dataset_projection_head_id: string
          p_reject_policy_version: string
          p_run_purpose: string
          p_source_release_id: string
        }
        Returns: {
          attempt_number: number
          current_state: string
          import_run_id: string
        }[]
      }
      fingerprint_json_v1: { Args: { p_value: Json }; Returns: string }
      fingerprint_source_release_manifest_v1: {
        Args: { p_manifest: Json }
        Returns: string
      }
      foundation_food_projection_body_v1: {
        Args: {
          p_food_id: string
          p_source_record_id: string
          p_source_record_version_id: string
        }
        Returns: Json
      }
      get_completed_foundation_promotion_receipt: {
        Args: { p_import_run_id: string }
        Returns: {
          inserted_food_count: number
          inserted_nutrient_count: number
          inserted_portion_count: number
          promotion_approval_id: string
          promotion_receipt_id: string
          receipt_fingerprint: string
        }[]
      }
      get_foundation_lifecycle_head: {
        Args: { p_environment: string }
        Returns: {
          dataset_projection_fingerprint: string
          dataset_projection_head_id: string
          food_head_count: number
          head_version: number
          source_release_id: string
        }[]
      }
      jsonb_safe_count_object_has_exact_keys: {
        Args: { p_expected_keys: string[]; p_value: Json }
        Returns: boolean
      }
      jsonb_sha256_array_is_exact: {
        Args: { p_maximum: number; p_minimum: number; p_value: Json }
        Returns: boolean
      }
      jsonb_sha256_object_has_exact_keys: {
        Args: { p_expected_keys: string[]; p_value: Json }
        Returns: boolean
      }
      promote_validated_foundation_run: {
        Args: { p_promotion_approval_id: string }
        Returns: {
          failure_category: string
          inserted_food_count: number
          inserted_nutrient_count: number
          inserted_portion_count: number
          promotion_receipt_id: string
          promotion_status: string
          receipt_fingerprint: string
        }[]
      }
      record_import_run_item: {
        Args: {
          p_action: string
          p_category?: string
          p_evidence_reference?: string
          p_import_run_id: string
          p_outcome: string
          p_source_record_version_id: string
          p_source_row_key: string
        }
        Returns: string
      }
      register_foundation_lifecycle_allowance: {
        Args: { p_contract: Json }
        Returns: string
      }
      register_foundation_lifecycle_update_approval: {
        Args: { p_contract: Json; p_validation_receipt_id: string }
        Returns: string
      }
      register_foundation_reconciliation_decision: {
        Args: { p_contract: Json }
        Returns: string
      }
      register_foundation_reject_allowance: {
        Args: { p_allowance: Json }
        Returns: {
          allowance_fingerprint: string
          reject_allowance_id: string
        }[]
      }
      register_foundation_release_scope_evidence: {
        Args: { p_contract: Json }
        Returns: string
      }
      register_source_release: { Args: { p_manifest: Json }; Returns: string }
      stage_candidate: {
        Args: {
          p_concept_key: string
          p_expires_at: string
          p_import_run_id: string
          p_normalized_candidate: Json
          p_normalized_content_sha256: string
          p_reject_category: string
          p_source_row_key: string
          p_staged_source_record_id: string
          p_upstream_version_key: string
          p_validation_status: string
          p_warning_count: number
        }
        Returns: string
      }
      stage_source_record: {
        Args: {
          p_expires_at: string
          p_import_run_id: string
          p_payload_sha256: string
          p_raw_payload: Json
          p_source_row_key: string
        }
        Returns: string
      }
      transition_import_run: {
        Args: {
          p_artifact_reference?: string
          p_counts?: Json
          p_expected_state: string
          p_failure_category?: string
          p_import_run_id: string
          p_next_state: string
          p_operator_execution_identity: string
          p_reason?: string
        }
        Returns: {
          current_state: string
          event_sequence: number
          import_run_id: string
        }[]
      }
      validate_foundation_run: {
        Args: {
          p_import_run_id: string
          p_reject_allowance_id: string
          p_report: Json
          p_target_environment: string
        }
        Returns: {
          failure_category: string
          receipt_fingerprint: string
          validation_receipt_id: string
          validation_state: string
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
  ingestion: {
    Enums: {},
  },
} as const
