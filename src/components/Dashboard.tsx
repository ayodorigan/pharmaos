import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Calendar,
  DollarSign,
  ShoppingCart,
  Users,
  Activity
} from 'lucide-react';
import { DashboardStats } from '../types';
import { supabase } from '../lib/supabase';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch products for inventory stats
      const { data: products } = await supabase
        .from('products')
        .select('*');

      // Fetch today's sales
      const today = new Date().toISOString().split('T')[0];
      const { data: todaySales } = await supabase
        .from('sales')
        .select('total')
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      // Fetch recent sales for trends
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: recentSales } = await supabase
        .from('sales')
        .select('total, created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Fetch top selling products
      const { data: topProducts } = await supabase
        .from('sale_items')
        .select(`
          product_name,
          quantity,
          total,
          sale_id!inner(created_at)
        `)
        .gte('sale_id.created_at', sevenDaysAgo.toISOString());

      // Calculate stats
      const totalProducts = products?.length || 0;
      const lowStockItems = products?.filter(p => p.stock_level <= p.min_stock_level).length || 0;
      
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
      const expiringSoon = products?.filter(p => 
        new Date(p.expiry_date) <= threeMonthsFromNow
      ).length || 0;

      const todayTotal = todaySales?.reduce((sum, sale) => sum + sale.total, 0) || 0;

      // Calculate monthly sales (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthlyTotal = recentSales?.filter(sale => 
        new Date(sale.created_at) >= thirtyDaysAgo
      ).reduce((sum, sale) => sum + sale.total, 0) || 0;

      // Process top selling products
      const productSales = new Map<string, { quantity: number; revenue: number }>();
      topProducts?.forEach(item => {
        const current = productSales.get(item.product_name) || { quantity: 0, revenue: 0 };
        productSales.set(item.product_name, {
          quantity: current.quantity + item.quantity,
          revenue: current.revenue + item.total
        });
      });

      const topSellingProducts = Array.from(productSales.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Process sales trend (last 7 days)
      const salesByDate = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        salesByDate.set(dateStr, 0);
      }

      recentSales?.forEach(sale => {
        const dateStr = sale.created_at.split('T')[0];
        if (salesByDate.has(dateStr)) {
          salesByDate.set(dateStr, salesByDate.get(dateStr)! + sale.total);
        }
      });

      const salesTrend = Array.from(salesByDate.entries()).map(([date, sales]) => ({
        date,
        sales
      }));

      const dashboardStats: DashboardStats = {
        todaySales: todayTotal,
        totalProducts,
        lowStockItems,
        expiringSoon,
        monthlySales: monthlyTotal,
        topSellingProducts,
        salesTrend
      };

      setStats(dashboardStats);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Sales",
      value: `KES ${stats.todaySales.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      change: '+12.5%'
    },
    {
      title: 'Total Products',
      value: stats.totalProducts.toLocaleString(),
      icon: Package,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      change: '+3.2%'
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockItems.toString(),
      icon: AlertTriangle,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      change: 'Needs attention'
    },
    {
      title: 'Expiring Soon',
      value: stats.expiringSoon.toString(),
      icon: Calendar,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      change: 'Next 30 days'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className={`${stat.bgColor} rounded-xl p-6 border border-gray-200`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{stat.change}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Sales Trend (Last 7 Days)</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {stats.salesTrend.map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {new Date(day.date).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, (day.sales / Math.max(...stats.salesTrend.map(d => d.sales))) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    KES {day.sales.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Top Selling Products</h3>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {stats.topSellingProducts.length > 0 ? stats.topSellingProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-medium text-teal-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-500">{product.quantity} units sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">KES {product.revenue.toLocaleString()}</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No sales data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => window.location.hash = '#pos'}
            className="flex items-center space-x-3 p-4 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
          >
            <ShoppingCart className="w-5 h-5 text-teal-600" />
            <div className="text-left">
              <p className="font-medium text-teal-900">New Sale</p>
              <p className="text-sm text-teal-600">Process customer purchase</p>
            </div>
          </button>
          <button 
            onClick={() => window.location.hash = '#inventory'}
            className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Package className="w-5 h-5 text-blue-600" />
            <div className="text-left">
              <p className="font-medium text-blue-900">Manage Inventory</p>
              <p className="text-sm text-blue-600">Add or update products</p>
            </div>
          </button>
          <button 
            onClick={() => window.location.hash = '#reports'}
            className="flex items-center space-x-3 p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <div className="text-left">
              <p className="font-medium text-orange-900">View Reports</p>
              <p className="text-sm text-orange-600">Sales and inventory reports</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};