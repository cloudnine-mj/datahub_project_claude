import type {
  User,
  Lab,
  TechCell,
  Project,
  Plan,
  ApprovalConfig,
  ApprovalRequest,
  ApprovalStep,
  ConstructionReport,
  DataCard,
  Budget,
  CostRecord,
} from "@prisma/client";

// Re-export Prisma types
export type {
  User,
  Lab,
  TechCell,
  Project,
  Plan,
  ApprovalConfig,
  ApprovalRequest,
  ApprovalStep,
  ConstructionReport,
  DataCard,
  Budget,
  CostRecord,
};

// Extended types with relations
export type UserWithRelations = User & {
  lab?: Lab | null;
  techCell?: TechCell | null;
};

export type PlanWithRelations = Plan & {
  project: Project;
  author: User;
  dataManager?: User | null;
  qualityManager?: User | null;
  techCell?: TechCell | null;
  lab?: Lab | null;
  approvalRequests?: ApprovalRequestWithSteps[];
  reports?: ConstructionReport[];
};

export type ApprovalRequestWithSteps = ApprovalRequest & {
  steps: (ApprovalStep & { approver: User })[];
  config: ApprovalConfig;
  plan?: Plan | null;
  report?: ConstructionReport | null;
};

export type ReportWithRelations = ConstructionReport & {
  plan: Plan;
  project: Project;
  author: User;
  dataManager?: User | null;
  qualityManager?: User | null;
  dataCards?: DataCard[];
};

export type BudgetWithRecords = Budget & {
  costRecords: CostRecord[];
};

// Session user type
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: string;
  labId?: string | null;
  techCellId?: string | null;
}

// API response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Approval config step definition
export interface ApprovalStepConfig {
  order: number;
  role: "PM_LEADER" | "TM_LEADER" | "LAB_LEADER" | "TECH_CELL_LEADER";
  resolveFrom: string;
}
