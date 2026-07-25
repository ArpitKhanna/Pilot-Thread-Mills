import type { EmployeeRole } from "@/lib/auth/types";
import type { Employee } from "./types";

export type DbEmployeeRow = {
  id: string;
  full_name: string;
  phone: string;
  role: EmployeeRole;
  pin: string | null;
  is_active: boolean;
  created_at: string;
};

export function mapEmployeeRow(row: DbEmployeeRow): Employee {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    pin: row.pin,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}
