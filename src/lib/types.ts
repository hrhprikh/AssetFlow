// ============================================================
// AssetFlow — TypeScript Types (mirrors database schema)
// ============================================================

export type UserRole = 'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE' | 'AUDITOR'
export type EntityStatus = 'ACTIVE' | 'INACTIVE'
export type AssetStatus = 'AVAILABLE' | 'ALLOCATED' | 'RESERVED' | 'UNDER_MAINTENANCE' | 'LOST' | 'RETIRED' | 'DISPOSED'
export type AllocationStatus = 'ACTIVE' | 'RETURNED' | 'TRANSFERRED'
export type TransferStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED'
export type BookingStatus = 'PENDING' | 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'REJECTED'
export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type MaintenanceStatusType = 'PENDING' | 'APPROVED' | 'REJECTED' | 'TECHNICIAN_ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED'
export type AuditCycleStatus = 'DRAFT' | 'OPEN' | 'CLOSED'
export type AuditResult = 'PENDING' | 'VERIFIED' | 'MISSING' | 'DAMAGED'

export interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  department_id: string | null
  status: EntityStatus
  avatar_url: string | null
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface Department {
  id: string
  name: string
  code: string
  parent_id: string | null
  head_user_id: string | null
  status: EntityStatus
  created_at: string
  updated_at: string
  // Joined fields
  head?: Profile
  parent?: Department
  [key: string]: any
}

export interface AssetCategory {
  id: string
  name: string
  description: string | null
  custom_field_schema: Record<string, unknown>
  status: EntityStatus
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface Asset {
  id: string
  asset_tag: string
  name: string
  category_id: string
  serial_number: string | null
  acquisition_date: string | null
  acquisition_cost: number | null
  condition: string | null
  location: string | null
  status: AssetStatus
  is_bookable: boolean
  current_department_id: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined fields
  category?: AssetCategory
  department?: Department
  [key: string]: any
}

export interface AssetAttachment {
  id: string
  asset_id: string
  file_url: string
  file_type: string | null
  uploaded_by: string | null
  created_at: string
  [key: string]: any
}

export interface Allocation {
  id: string
  asset_id: string
  holder_type: 'EMPLOYEE' | 'DEPARTMENT'
  holder_id: string
  allocated_by: string
  allocated_at: string
  expected_return_at: string | null
  returned_at: string | null
  return_condition: string | null
  return_notes: string | null
  status: AllocationStatus
  created_at: string
  // Joined fields
  asset?: Asset
  holder?: Profile
  allocated_by_user?: Profile
  [key: string]: any
}

export interface TransferRequest {
  id: string
  asset_id: string
  from_allocation_id: string
  target_holder_type: 'EMPLOYEE' | 'DEPARTMENT'
  target_holder_id: string
  requested_by: string
  approved_by: string | null
  status: TransferStatus
  reason: string | null
  decision_notes: string | null
  created_at: string
  decided_at: string | null
  // Joined fields
  asset?: Asset
  requester?: Profile
  target?: Profile
  [key: string]: any
}

export interface Booking {
  id: string
  asset_id: string
  requester_id: string
  department_id: string | null
  start_at: string
  end_at: string
  purpose: string | null
  status: BookingStatus
  reminder_sent_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  asset?: Asset
  requester?: Profile
  [key: string]: any
}

export interface MaintenanceRequest {
  id: string
  asset_id: string
  raised_by: string
  issue: string
  priority: MaintenancePriority
  status: MaintenanceStatusType
  approved_by: string | null
  technician: string | null
  approved_at: string | null
  started_at: string | null
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  // Joined fields
  asset?: Asset
  raiser?: Profile
  [key: string]: any
}

export interface AuditCycle {
  id: string
  name: string
  scope_type: 'DEPARTMENT' | 'LOCATION'
  scope_id: string | null
  start_date: string
  end_date: string
  status: AuditCycleStatus
  created_by: string | null
  closed_by: string | null
  closed_at: string | null
  created_at: string
  [key: string]: any
}

export interface AuditAssignment {
  audit_cycle_id: string
  auditor_id: string
  auditor?: Profile
  [key: string]: any
}

export interface AuditItem {
  id: string
  audit_cycle_id: string
  asset_id: string
  result: AuditResult
  notes: string | null
  evidence_url: string | null
  verified_by: string | null
  verified_at: string | null
  resolution_status: string | null
  // Joined fields
  asset?: Asset
  [key: string]: any
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
  [key: string]: any
}

export interface ActivityLog {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  // Joined fields
  actor?: Profile
  [key: string]: any
}

export interface DashboardKPIs {
  available_assets: number
  allocated_assets: number
  under_maintenance: number
  active_bookings: number
  overdue_returns: number
  pending_transfers: number
  pending_maintenance: number
  total_assets: number
}
