export interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: 'super_admin' | 'pharmtech' | 'cashier';
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  supplier: string;
  batchNumber: string;
  expiryDate: string;
  costPrice: number;
  sellingPrice: number;
  stockLevel: number;
  minStockLevel: number;
  barcode: string;
  requiresPrescription: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'mpesa' | 'card' | 'insurance';
  staffId: string;
  staffName: string;
  timestamp: string;
  receiptNumber: string;
  mpesaTransactionId?: string;
}

export interface DashboardStats {
  todaySales: number;
  totalProducts: number;
  lowStockItems: number;
  expiringSoon: number;
  monthlySales: number;
  topSellingProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesTrend: Array<{
    date: string;
    sales: number;
  }>;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}