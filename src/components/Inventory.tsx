import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  AlertTriangle,
  Calendar,
  Package,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';
import { Product } from '../types';
import { ProductModal } from './ProductModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(['all']);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, showLowStock, showExpiringSoon]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      const mappedProducts: Product[] = data.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        supplier: item.supplier,
        batchNumber: item.batch_number,
        expiryDate: item.expiry_date,
        costPrice: item.cost_price,
        sellingPrice: item.selling_price,
        stockLevel: item.stock_level,
        minStockLevel: item.min_stock_level,
        barcode: item.barcode || '',
        requiresPrescription: item.requires_prescription,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      setProducts(mappedProducts);
      
      // Extract unique categories
      const uniqueCategories = ['all', ...Array.from(new Set(mappedProducts.map(p => p.category)))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error in fetchProducts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode.includes(searchTerm)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    if (showLowStock) {
      filtered = filtered.filter(product => product.stockLevel <= product.minStockLevel);
    }

    if (showExpiringSoon) {
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
      
      filtered = filtered.filter(product => {
        const expiryDate = new Date(product.expiryDate);
        return expiryDate <= threeMonthsFromNow;
      });
    }

    setFilteredProducts(filtered);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product. Please try again.');
        return;
      }

      setProducts(products.filter(p => p.id !== productId));
    } catch (error) {
      console.error('Error in handleDelete:', error);
      alert('Error deleting product. Please try again.');
    }
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            name: productData.name,
            category: productData.category,
            supplier: productData.supplier,
            batch_number: productData.batchNumber,
            expiry_date: productData.expiryDate,
            cost_price: productData.costPrice,
            selling_price: productData.sellingPrice,
            stock_level: productData.stockLevel,
            min_stock_level: productData.minStockLevel,
            barcode: productData.barcode,
            requires_prescription: productData.requiresPrescription
          })
          .eq('id', editingProduct.id);

        if (error) {
          console.error('Error updating product:', error);
          alert('Error updating product. Please try again.');
          return;
        }
      } else {
        // Add new product
        const { error } = await supabase
          .from('products')
          .insert({
            name: productData.name!,
            category: productData.category!,
            supplier: productData.supplier!,
            batch_number: productData.batchNumber!,
            expiry_date: productData.expiryDate!,
            cost_price: productData.costPrice!,
            selling_price: productData.sellingPrice!,
            stock_level: productData.stockLevel!,
            min_stock_level: productData.minStockLevel!,
            barcode: productData.barcode,
            requires_prescription: productData.requiresPrescription || false
          });

        if (error) {
          console.error('Error adding product:', error);
          alert('Error adding product. Please try again.');
          return;
        }
      }

      await fetchProducts(); // Refresh the list
      setShowModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error in handleSaveProduct:', error);
      alert('Error saving product. Please try again.');
    }
  };

  const getStockStatus = (product: Product) => {
    if (product.stockLevel <= product.minStockLevel) {
      return { status: 'Low Stock', color: 'text-red-600 bg-red-100' };
    }
    if (product.stockLevel <= product.minStockLevel * 1.5) {
      return { status: 'Medium Stock', color: 'text-orange-600 bg-orange-100' };
    }
    return { status: 'In Stock', color: 'text-green-600 bg-green-100' };
  };

  const isExpiringSoon = (expiryDate: string) => {
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    return new Date(expiryDate) <= threeMonthsFromNow;
  };

  const exportProducts = () => {
    if (filteredProducts.length === 0) {
      alert('No products to export');
      return;
    }

    const headers = [
      'Name', 'Category', 'Supplier', 'Batch Number', 'Expiry Date',
      'Cost Price', 'Selling Price', 'Stock Level', 'Min Stock Level',
      'Barcode', 'Requires Prescription'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredProducts.map(product => [
        `"${product.name}"`,
        `"${product.category}"`,
        `"${product.supplier}"`,
        `"${product.batchNumber}"`,
        product.expiryDate,
        product.costPrice,
        product.sellingPrice,
        product.stockLevel,
        product.minStockLevel,
        `"${product.barcode}"`,
        product.requiresPrescription
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const canModifyInventory = user?.role === 'super_admin' || user?.role === 'pharmtech';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          {canModifyInventory && (
            <>
              <button
                onClick={() => setShowModal(true)}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
              <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>Import CSV</span>
              </button>
            </>
          )}
          <button
            onClick={exportProducts}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button
            onClick={fetchProducts}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search products, batch numbers, or suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>

          {/* Quick Filters */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowLowStock(!showLowStock)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                showLowStock
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setShowExpiringSoon(!showExpiringSoon)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                showExpiringSoon
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Expiring Soon
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Product Details
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Stock Level
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Pricing
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Expiry Date
                </th>
                {canModifyInventory && (
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const stockStatus = getStockStatus(product);
                const expiringSoon = isExpiringSoon(product.expiryDate);
                
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                            {product.name}
                            {product.requiresPrescription && (
                              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                Rx
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{product.category}</div>
                          <div className="text-xs text-gray-400">Batch: {product.batchNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}>
                          {stockStatus.status}
                        </span>
                        <div className="text-sm text-gray-900 mt-1">{product.stockLevel} units</div>
                        <div className="text-xs text-gray-500">Min: {product.minStockLevel}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div>Sale: KES {product.sellingPrice}</div>
                        <div className="text-gray-500">Cost: KES {product.costPrice}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${expiringSoon ? 'text-red-600' : 'text-gray-900'}`}>
                        {new Date(product.expiryDate).toLocaleDateString()}
                        {expiringSoon && (
                          <div className="flex items-center mt-1">
                            <AlertTriangle className="w-4 h-4 text-red-500 mr-1" />
                            <span className="text-xs text-red-600">Expiring Soon</span>
                          </div>
                        )}
                      </div>
                    </td>
                    {canModifyInventory && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No products found</h3>
            <p className="text-gray-500 mt-2">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showModal && canModifyInventory && (
        <ProductModal
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
};