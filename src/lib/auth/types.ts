export type AccountType = "employee" | "customer";
export type AuthMethod = "pin" | "otp_whatsapp";
export type EmployeeRole = "admin" | "manager" | "operator";

export type Profile = {
  id: string;
  phone: string;
  full_name: string;
  account_type: AccountType;
  auth_method: AuthMethod;
  role: EmployeeRole | null;
  is_active: boolean;
  created_at: string;
};
