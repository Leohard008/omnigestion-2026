import { Organization, User, OrganizationMember, Customer, Product, Invoice, Quote, Expense } from "@prisma/client";

// Re-export Prisma types
export type { Organization, User, OrganizationMember, Customer, Product, Invoice, Quote, Expense };

// Extended types with relations
export type OrganizationWithMembers = Organization & {
  members: (OrganizationMember & { user: User })[];
};

export type InvoiceWithDetails = Invoice & {
  customer: Customer;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
  }>;
};

export type QuoteWithDetails = Quote & {
  customer: Customer;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
  }>;
};

// API Response types
export type ApiResponse<T> = {
  data?: T;
  error?: string;
  message?: string;
};

// Form types
export type InvoiceFormData = {
  customerId: string;
  dueDate?: Date;
  items: Array<{
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
  notes?: string;
  currency: "DZD" | "EUR";
};

export type QuoteFormData = {
  customerId: string;
  validUntil?: Date;
  items: Array<{
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
  notes?: string;
  currency: "DZD" | "EUR";
};

// Dashboard stats type
export type DashboardStats = {
  totalRevenue: number;
  pendingInvoices: number;
  totalCustomers: number;
  totalQuotes: number;
  currency: "DZD" | "EUR";
};
