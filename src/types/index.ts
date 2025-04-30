export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  department: string;
  position: string;
  status: 'active' | 'inactive';
  avatarUrl?: string;
  extensionNumber?: string;
  sipPassword?: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'manager' | 'employee' | 'supervisor';

export type Permission = 
  | 'user:create' 
  | 'user:read' 
  | 'user:update' 
  | 'user:delete'
  | 'department:create'
  | 'department:read'
  | 'department:update'
  | 'department:delete'
  | 'call:make'
  | 'call:receive'
  | 'call:record'
  | 'call:listen'
  | 'call:report'
  | 'customer:create'
  | 'customer:read'
  | 'customer:update'
  | 'customer:delete';

export interface Department {
  id: string;
  name: string;
  managerId?: string;
  managerName?: string;
  parentDepartmentId?: string;
  departmentCode?: string;
  orderIndex?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VerimorConfig {
  apiKey: string;
  apiSecret: string;
  pbxUrl: string;
}

export interface CallRecord {
  id: string;
  direction: 'incoming' | 'outgoing';
  from: string;
  to: string;
  duration: number; // seconds
  status: 'answered' | 'missed' | 'voicemail' | 'failed';
  recordingUrl?: string;
  notes?: string;
  userId: string;
  customerId?: string;
  startTime: string;
  endTime: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  mobile?: string;
  email?: string;
  company?: string;
  assignedUserId?: string;
  status: 'lead' | 'customer' | 'inactive';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  lastContactDate?: string;
  classification?: 'vip' | 'standard' | 'inactive';
  acquisitionSource?: string;
  acquisitionDate?: string;
  lifetimeValue?: number;
}

export interface Contract {
  id: string;
  customerId: string;
  title: string;
  startDate: string;
  endDate?: string;
  value: number;
  status: 'draft' | 'pending' | 'active' | 'completed' | 'terminated';
  fileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  customerId?: string;
  status: 'planning' | 'active' | 'onHold' | 'completed';
  startDate: string;
  endDate?: string;
  progress: number; // 0-100
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'inProgress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigneeId?: string;
  projectId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  title: string;
  path: string;
  icon: string;
  permission?: Permission;
}

// SIP related types
export interface SipCredentials {
  sipUrl: string;
  username: string;
  password: string;
  server: string;
}

export interface SipCallEvent {
  callId: string;
  caller: string;
  callee: string;
  status: 'ringing' | 'connected' | 'ended' | 'failed';
}