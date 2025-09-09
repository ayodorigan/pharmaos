import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  Users, 
  Package,
  DollarSign,
  Filter
} from 'lucide-react';
import { Sale } from '../types';
import { supabase } from '../lib/supabase';

export const Reports: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedReport, setSelectedReport] = useState<'daily' | 'product' | 'staff'>('daily');
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    filterSales();
  }, [sales, dateRange]);

  const fetchSales = async () => {
    try {
      setIsLoading(true);
      
      // Fetch sales with staff information
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          user_profiles!sales_cashier_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        return;
      }

      // Fetch sale items for each sale
      const salesWithItems = await Promise.all(
        (salesData || []).map(async (sale) => {
          const { data: items, error: itemsError } = await supabase
            .from('sale_items')
            .select('*')
            .eq('sale_id', sale.id);

          if (itemsError) {
            console.error('Error fetching sale items:', itemsError);
            return { ...sale, items: [] };
          }

          return { ...sale, items: items || [], staff_name: sale.profiles?.name || 'Unknown' };
          return { ...sale, items: items || [], staff_name: sale.user_profiles?.full_name || 'Unknown' };
        })
      );

      setSales(salesWithItems);
    } catch (error) {
      console.error('Error in fetchSales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterSales = () => {
    const filtered = sales.filter(sale => {
      const saleDate = new Date(sale.created_at).toDateString();
      const startDate = new Date(dateRange.startDate).toDateString();
      const endDate = new Date(dateRange.endDate).toDateString();
      
      return saleDate >= startDate && saleDate <= endDate;
    });
    setFilteredSales(filtered);
  };

  const generateDailyReport = () => {
    const dailySales = new Map<string, { sales: number; transactions: number; items: number }>();
    
    filteredSales.forEach(sale => {
      const date = new Date(sale.created_at).toDateString();
      const current = dailySales.get(date) || { sales: 0, transactions: 0, items: 0 };
      
      const itemsCount = sale.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
      
      dailySales.set(date, {
        sales: current.sales + sale.total,
        transactions: current.transactions + 1,
        items: current.items + itemsCount
      });
    });

    return Array.from(dailySales.entries()).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString(),
      ...data
    }));
  };

  const generateProductReport = () => {
    const productSales = new Map<string, { quantity: number; revenue: number; transactions: number }>();
    
    filteredSales.forEach(sale => {
      sale.items.forEach((item: any) => {
        const current = productSales.get(item.product_name) || { quantity: 0, revenue: 0, transactions: 0 };
        
        productSales.set(item.product_name, {
          quantity: current.quantity + item.quantity,
          revenue: current.revenue + item.total,
          transactions: current.transactions + 1
        });
      });
    });

    return Array.from(productSales.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  const generateStaffReport = () => {
    const staffSales = new Map<string, { sales: number; transactions: number }>();
    
    filteredSales.forEach(sale => {
      const current = staffSales.get(sale.staff_name) || { sales: 0, transactions: 0 };
      
      staffSales.set(sale.staff_name, {
        sales: current.sales + sale.total,
        transactions: current.transactions + 1
      });
    });

    return Array.from(staffSales.entries()).map(([name, data]) => ({
      name,
      ...data,
      averageTransaction: data.transactions > 0 ? data.sales / data.transactions : 0
    }));
  };

  const getTotalStats = () => {
    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalTransactions = filteredSales.length;
    const totalItems = filteredSales.reduce((sum, sale) => 
      sum + sale.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0
    );
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    return { totalSales, totalTransactions, totalItems, averageTransaction };
  };

  const exportReport = (type: 'csv' | 'pdf') => {
    let reportData: any[] = [];
    let filename = '';

    switch (selectedReport) {
      case 'daily':
        reportData = generateDailyReport();
        filename = `daily-sales-${dateRange.startDate}-to-${dateRange.endDate}`;
        break;
      case 'product':
        reportData = generateProductReport();
        filename = `product-sales-${dateRange.startDate}-to-${dateRange.endDate}`;
        break;
      case 'staff':
        reportData = generateStaffReport();
        filename = `staff-performance-${dateRange.startDate}-to-${dateRange.endDate}`;
        break;
    }

    if (type === 'csv' && reportData.length > 0) {
      const csv = [
        Object.keys(reportData[0]).join(','),
        ...reportData.map(row => Object.values(row).map(val => 
          typeof val === 'string' ? `"${val}"` : val
        ).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const stats = getTotalStats();
  const dailyData = generateDailyReport();
  const productData = generateProductReport();
  const staffData = generateStaffReport();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="daily">Daily Sales</option>
              <option value="product">Product Performance</option>
              <option value="staff">Staff Performance</option>
            </select>
            <button
              onClick={() => exportReport('csv')}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">KES {stats.totalSales.toLocaleString()}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Items Sold</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Transaction</p>
              <p className="text-2xl font-bold text-gray-900">KES {stats.averageTransaction.toFixed(0)}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            {selectedReport === 'daily' && (
              <>
                <Calendar className="w-5 h-5 mr-2 text-teal-600" />
                Daily Sales Report
              </>
            )}
            {selectedReport === 'product' && (
              <>
                <Package className="w-5 h-5 mr-2 text-teal-600" />
                Product Performance Report
              </>
            )}
            {selectedReport === 'staff' && (
              <>
                <Users className="w-5 h-5 mr-2 text-teal-600" />
                Staff Performance Report
              </>
            )}
          </h3>
        </div>

        <div className="overflow-x-auto">
          {selectedReport === 'daily' && (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Sales</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Transactions</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Items Sold</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyData.map((row, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">KES {row.sales.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.transactions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedReport === 'product' && (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Quantity Sold</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Transactions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productData.map((row, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">KES {row.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.transactions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedReport === 'staff' && (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Staff Member</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Total Sales</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Transactions</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Avg Transaction</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffData.map((row, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">KES {row.sales.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.transactions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">KES {row.averageTransaction.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No data available</h3>
            <p className="text-gray-500 mt-2">No sales found for the selected date range</p>
          </div>
        )}
      </div>
    </div>
  );
};