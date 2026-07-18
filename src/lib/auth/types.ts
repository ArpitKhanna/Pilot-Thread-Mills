export type AccountType = "employee" | "customer";
export type AuthMethod = "pin" | "otp_whatsapp";
export type EmployeeRole =
  | "admin"
  | "accountant"
  | "picker"
  | "delivery"
  | "dyeing_user";

export type ItemType =
  | "dibbi"
  | "box"
  | "cone"
  | "zip"
  | "elastic"
  | "saree_fall";
export type PriceItemStatus = "approved" | "pending_approval" | "rejected";

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

export type AppModule = {
  id: string;
  name: string;
  section: "overview" | "orders" | "entities";
  href: string;
  sort_order: number;
};

export type PriceListItem = {
  id: string;
  item_name: string;
  item_type: ItemType;
  count_label: string | null;
  salesmen_price: number;
  customer_price: number;
  status: PriceItemStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export const ITEM_TYPES: ItemType[] = [
  "dibbi",
  "box",
  "cone",
  "zip",
  "elastic",
  "saree_fall",
];

/** Item types that use the thread count dropdown */
export const COUNT_ITEM_TYPES: ItemType[] = ["dibbi", "box", "cone"];

export const COUNT_OPTIONS = [
  "3/58",
  "3/64",
  "2/50",
  "2/20",
  "3/42",
  "2/40",
  "2/30",
  "3/57",
  "3/30",
  "3/20",
  "15/S",
  "303",
  "2/60",
  "2/42",
  "4/12",
] as const;

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  dibbi: "Dibbi",
  box: "Box",
  cone: "Cone",
  zip: "Zip",
  elastic: "Elastic",
  saree_fall: "Saree Fall",
};

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  admin: "Admin",
  accountant: "Accountant",
  picker: "Picker",
  delivery: "Delivery",
  dyeing_user: "Dyeing User",
};
