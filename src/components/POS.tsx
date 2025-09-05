import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Scan, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard,
  DollarSign,
  Smartphone,
  Shield,
  Receipt,
  ShoppingCart
} from 'lucide-react';
import { Product, SaleItem, Sale } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export const POS: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'mpesa' | 'card' | 'insurance'>('cash');
  const [showPayment, setShowPayment] = useState(false);
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [cashReceived, setCashReceived] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchTerm))
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('stock_level', 0) // Only show products in stock
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
    } catch (error) {
      console.error('Error in fetchProducts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cartItems.find(item => item.productId === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stockLevel) {
        setCartItems(cartItems.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item
        ));
      } else {
        alert('Insufficient stock available');
      }
    } else {
      const newItem: SaleItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.sellingPrice,
        total: product.sellingPrice
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      setCartItems(cartItems.filter(item => item.productId !== productId));
    } else {
      const product = products.find(p => p.id === productId);
      if (product && newQuantity <= product.stockLevel) {
        setCartItems(cartItems.map(item =>
          item.productId === productId
            ? { ...item, quantity: newQuantity, total: newQuantity * item.unitPrice }
            : item
        ));
      } else {
        alert('Insufficient stock available');
      }
    }
  };

  const removeFromCart = (productId: string) => {
    setCartItems(cartItems.filter(item => item.productId !== productId));
  };

  const getCartTotal = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.16; // 16% VAT in Kenya
    return { subtotal, tax, total: subtotal + tax };
  };

  const { subtotal, tax, total } = getCartTotal();

  const handlePayment = async () => {
    if (cartItems.length === 0) return;
    if (!user) return;

    setIsProcessing(true);

    try {
      // Generate receipt number
      const receiptNumber = `RCP-${Date.now()}`;
      
      // Create sale record
      const saleData = {
        receipt_number: receiptNumber,
        subtotal,
        tax,
        total,
        payment_method: selectedPaymentMethod,
        staff_id: user.id,
        ...(selectedPaymentMethod === 'mpesa' && { mpesa_transaction_id: `MP${Date.now()}` })
      };

      const { data: saleResult, error: saleError } = await supabase
        .from('sales')
        .insert(saleData)
        .select()
        .single();

      if (saleError) {
        console.error('Error creating sale:', saleError);
        alert('Error processing sale. Please try again.');
        return;
      }

      // Create sale items
      const saleItemsData = cartItems.map(item => ({
        sale_id: saleResult.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItemsData);

      if (itemsError) {
        console.error('Error creating sale items:', itemsError);
        alert('Error processing sale items. Please try again.');
        return;
      }

      // Update product stock levels
      for (const item of cartItems) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            stock_level: products.find(p => p.id === item.productId)!.stockLevel - item.quantity 
          })
          .eq('id', item.productId);

        if (updateError) {
          console.error('Error updating stock:', updateError);
        }
      }

      // Create sale object for display
      const sale: Sale = {
        id: saleResult.id,
        items: cartItems,
        subtotal,
        tax,
        total,
        paymentMethod: selectedPaymentMethod,
        staffId: user.id,
        staffName: user.name,
        timestamp: saleResult.created_at,
        receiptNumber,
        ...(selectedPaymentMethod === 'mpesa' && { mpesaTransactionId: saleData.mpesa_transaction_id })
      };

      setLastSale(sale);
      setCartItems([]);
      setShowPayment(false);
      setCashReceived(0);
      setMpesaNumber('');
      
      // Refresh products to update stock levels
      await fetchProducts();
    } catch (error) {
      console.error('Error in handlePayment:', error);
      alert('Error processing payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateBarcodeScan = () => {
    if (products.length === 0) return;
    
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    setSearchTerm(randomProduct.barcode);
    if (randomProduct.stockLevel > 0) {
      addToCart(randomProduct);
    }
  };

  const printReceipt = () => {
    if (!lastSale) return;
    
    const receiptWindow = window.open('', '_blank');
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${lastSale.receiptNumber}</title>
            <style>
              body { font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
              .item { display: flex; justify-content: space-between; margin: 5px 0; }
              .total { border-top: 1px solid #000; padding-top: 10px; margin-top: 10px; font-weight: bold; }
              .footer { text-align: center; margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>PharmaPOS</h2>
              <p>Receipt: ${lastSale.receiptNumber}</p>
              <p>${new Date(lastSale.timestamp).toLocaleString()}</p>
              <p>Staff: ${lastSale.staffName}</p>
            </div>
            
            ${lastSale.items.map(item => `
              <div class="item">
                <span>${item.productName} x${item.quantity}</span>
                <span>KES ${item.total.toFixed(2)}</span>
              </div>
            `).join('')}
            
            <div class="total">
              <div class="item">
                <span>Subtotal:</span>
                <span>KES ${lastSale.subtotal.toFixed(2)}</span>
              </div>
              <div class="item">
                <span>VAT (16%):</span>
                <span>KES ${lastSale.tax.toFixed(2)}</span>
              </div>
              <div class="item">
                <span>Total:</span>
                <span>KES ${lastSale.total.toFixed(2)}</span>
              </div>
              <div class="item">
                <span>Payment:</span>
                <span>${lastSale.paymentMethod.toUpperCase()}</span>
              </div>
            </div>
            
            <div class="footer">
              <p>Thank you for your purchase!</p>
              <p>Come again soon</p>
            </div>
          </body>
        </html>
      `);
      receiptWindow.document.close();
      receiptWindow.print();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-4">
        {/* Search and Barcode */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search products or scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={simulateBarcodeScan}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2"
            >
              <Scan className="w-4 h-4" />
              <span>Scan</span>
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Products</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 flex-1">{product.name}</h4>
                    {product.requiresPrescription && (
                      <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        Rx
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{product.category}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-teal-600">
                      KES {product.sellingPrice}
                    </span>
                    <span className="text-xs text-gray-500">
                      Stock: {product.stockLevel}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No products found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Cart ({cartItems.length})
            </h3>
          </div>

          {/* Cart Items */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {cartItems.map((item) => (
              <div key={item.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                  <p className="text-xs text-gray-500">KES {item.unitPrice} each</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="p-1 text-gray-400 hover:text-green-600 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {cartItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Cart is empty</p>
            </div>
          )}

          {/* Cart Total */}
          {cartItems.length > 0 && (
            <div className="border-t pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal:</span>
                <span>KES {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT (16%):</span>
                <span>KES {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-2">
                <span>Total:</span>
                <span>KES {total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Methods */}
        {cartItems.length > 0 && (
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { id: 'cash', label: 'Cash', icon: DollarSign },
                { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'insurance', label: 'Insurance', icon: Shield }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSelectedPaymentMethod(id as any)}
                  className={`p-3 border rounded-lg flex flex-col items-center space-y-1 transition-colors ${
                    selectedPaymentMethod === id
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPayment(true)}
              className="w-full bg-teal-600 text-white py-3 rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              Process Payment - KES {total.toFixed(2)}
            </button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Complete Payment
              </h3>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total Amount:</span>
                    <span className="text-xl font-bold text-teal-600">KES {total.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Payment Method: {selectedPaymentMethod.toUpperCase()}
                  </div>
                </div>

                {selectedPaymentMethod === 'mpesa' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      M-Pesa Number
                    </label>
                    <input
                      type="tel"
                      value={mpesaNumber}
                      onChange={(e) => setMpesaNumber(e.target.value)}
                      placeholder="254700000000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                )}

                {selectedPaymentMethod === 'cash' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cash Received
                    </label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    {cashReceived > 0 && (
                      <div className="mt-2 text-sm">
                        <div className="flex justify-between">
                          <span>Change:</span>
                          <span className="font-medium">
                            KES {Math.max(0, cashReceived - total).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={() => setShowPayment(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={isProcessing || (selectedPaymentMethod === 'cash' && cashReceived < total)}
                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Processing...' : 'Complete Sale'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {lastSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Receipt className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Sale Completed!</h3>
                <p className="text-gray-500 mt-1">Receipt #{lastSale.receiptNumber}</p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {lastSale.items.map((item) => (
                    <div key={item.productId} className="flex justify-between text-sm">
                      <span>{item.productName} x{item.quantity}</span>
                      <span>KES {item.total.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal:</span>
                      <span>KES {lastSale.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>VAT:</span>
                      <span>KES {lastSale.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Total:</span>
                      <span>KES {lastSale.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={printReceipt}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Print Receipt</span>
                  </button>
                  <button
                    onClick={() => setLastSale(null)}
                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};