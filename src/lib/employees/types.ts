import type { AppModule, EmployeeRole } from "@/lib/auth/types";

export type Employee = {
  id: string;
  fullName: string;
  phone: string;
  role: EmployeeRole;
  pin: string | null;
  isActive: boolean;
  createdAt: string;
};

export type RoleAccessGrant = {
  role: EmployeeRole;
  moduleId: string;
};

export type RoleAccessPayload = {
  modules: AppModule[];
  grants: RoleAccessGrant[];
};

export const EMPLOYEE_ROLES: EmployeeRole[] = [
  "admin",
  "accountant",
  "picker",
  "delivery",
  "dyeing_user",
];

export const EDITABLE_ROLES: EmployeeRole[] = [
  "accountant",
  "picker",
  "delivery",
  "dyeing_user",
];
