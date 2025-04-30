export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          id: number
          role_name: string
        }
        Insert: {
          id?: number
          role_name: string
        }
        Update: {
          id?: number
          role_name?: string
        }
        Relationships: []
      }
      personnel: {
        Row: {
          id: string
          user_id: string
          name: string
          surname: string
          email: string
          verimor_extension: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          surname: string
          email: string
          verimor_extension: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          surname?: string
          email?: string
          verimor_extension?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      personnel_roles: {
        Row: {
          personnel_id: string
          role_id: number
        }
        Insert: {
          personnel_id: string
          role_id: number
        }
        Update: {
          personnel_id?: string
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "personnel_roles_personnel_id_fkey"
            columns: ["personnel_id"]
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_roles_role_id_fkey"
            columns: ["role_id"]
            referencedRelation: "roles"
            referencedColumns: ["id"]
          }
        ]
      }
      customers: {
        Row: {
          id: string
          company_name: string
          contact_person_name: string
          tax_office: string
          tax_number: string
          address: string
          phone: string
          email: string
          customer_type: string
          created_at: string
          responsible_personnel_id: string
        }
        Insert: {
          id?: string
          company_name: string
          contact_person_name: string
          tax_office: string
          tax_number: string
          address: string
          phone: string
          email: string
          customer_type: string
          created_at?: string
          responsible_personnel_id: string
        }
        Update: {
          id?: string
          company_name?: string
          contact_person_name?: string
          tax_office?: string
          tax_number?: string
          address?: string
          phone?: string
          email?: string
          customer_type?: string
          created_at?: string
          responsible_personnel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_responsible_personnel_id_fkey"
            columns: ["responsible_personnel_id"]
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          }
        ]
      }
      customer_contacts: {
        Row: {
          id: string
          customer_id: string
          name: string
          surname: string
          title: string
          email: string
          phone: string
          edevlet_username: string
          edevlet_password: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          name: string
          surname: string
          title: string
          email: string
          phone: string
          edevlet_username?: string
          edevlet_password?: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          name?: string
          surname?: string
          title?: string
          email?: string
          phone?: string
          edevlet_username?: string
          edevlet_password?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      customer_notes: {
        Row: {
          id: string
          customer_id: string
          personnel_id: string
          note_content: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          personnel_id: string
          note_content: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          personnel_id?: string
          note_content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_personnel_id_fkey"
            columns: ["personnel_id"]
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string
          customer_id: string
          project_name: string
          status: string
          description: string
          created_at: string
          responsible_personnel_id: string
        }
        Insert: {
          id?: string
          customer_id: string
          project_name: string
          status?: string
          description: string
          created_at?: string
          responsible_personnel_id: string
        }
        Update: {
          id?: string
          customer_id?: string
          project_name?: string
          status?: string
          description?: string
          created_at?: string
          responsible_personnel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_responsible_personnel_id_fkey"
            columns: ["responsible_personnel_id"]
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          }
        ]
      }
      project_notes: {
        Row: {
          id: string
          project_id: string
          personnel_id: string
          note_content: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          personnel_id: string
          note_content: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          personnel_id?: string
          note_content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_personnel_id_fkey"
            columns: ["personnel_id"]
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          }
        ]
      }
      project_documents: {
        Row: {
          id: string
          project_id: string
          file_name: string
          storage_path: string
          uploaded_by: string
          uploaded_at: string
          file_size: number
          mime_type: string
        }
        Insert: {
          id?: string
          project_id: string
          file_name: string
          storage_path: string
          uploaded_by: string
          uploaded_at?: string
          file_size: number
          mime_type: string
        }
        Update: {
          id?: string
          project_id?: string
          file_name?: string
          storage_path?: string
          uploaded_by?: string
          uploaded_at?: string
          file_size?: number
          mime_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          }
        ]
      }
      call_logs: {
        Row: {
          id: string
          call_uuid: string
          direction: string
          caller_id_number: string
          caller_id_name: string
          destination_number: string
          destination_name: string
          start_stamp: string
          answer_stamp: string
          end_stamp: string
          duration: unknown
          talk_duration: unknown
          queue: string
          queue_wait_duration: unknown
          result: string
          answered: boolean
          missed: boolean
          recording_present: boolean
          sip_hangup_disposition: string
          hangup_cause: string
          recording_url_temp: string
          created_at: string
          related_customer_id: string | null
          related_personnel_id: string | null
        }
        Insert: {
          id?: string
          call_uuid: string
          direction: string
          caller_id_number: string
          caller_id_name: string
          destination_number: string
          destination_name: string
          start_stamp: string
          answer_stamp?: string
          end_stamp?: string
          duration?: unknown
          talk_duration?: unknown
          queue?: string
          queue_wait_duration?: unknown
          result?: string
          answered?: boolean
          missed?: boolean
          recording_present?: boolean
          sip_hangup_disposition?: string
          hangup_cause?: string
          recording_url_temp?: string
          created_at?: string
          related_customer_id?: string | null
          related_personnel_id?: string | null
        }
        Update: {
          id?: string
          call_uuid?: string
          direction?: string
          caller_id_number?: string
          caller_id_name?: string
          destination_number?: string
          destination_name?: string
          start_stamp?: string
          answer_stamp?: string
          end_stamp?: string
          duration?: unknown
          talk_duration?: unknown
          queue?: string
          queue_wait_duration?: unknown
          result?: string
          answered?: boolean
          missed?: boolean
          recording_present?: boolean
          sip_hangup_disposition?: string
          hangup_cause?: string
          recording_url_temp?: string
          created_at?: string
          related_customer_id?: string | null
          related_personnel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_related_customer_id_fkey"
            columns: ["related_customer_id"]
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_related_personnel_id_fkey"
            columns: ["related_personnel_id"]
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}