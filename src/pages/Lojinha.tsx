import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Barcode as BarcodeIcon,
  Download,
  FileText,
  Package,
  CreditCard,
  ShoppingBag,
  History,
  TrendingUp,
  Settings,
  Pencil,
  Trash2,
  Minus,
  X
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import Barcode from 'react-barcode';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import Logo from '../components/Logo';

interface Product {
  id: string;
  barcode: string;
  name: string;
  description?: string;
  size?: string;
  purchase_price?: number;
  sale_price?: number;
  price: number; // Sale price compatibility
  stock: number;
  category: string;
  min_stock?: number;
  max_stock?: number;
}

const Lojinha: React.FC = () => {
  const { profile, user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'estoque' | 'cadastros' | 'movimentacao' | 'pagvendas' | 'relatorios' | 'demandas' | 'configuracoes' | 'conferencia'>('estoque');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [demands, setDemands] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [stockAction, setStockAction] = useState<'entry' | 'exit'>('entry');
  const [quantity, setQuantity] = useState(1);
  const [scannedItems, setScannedItems] = useState<Record<string, number>>({});
  const [scanInput, setScanInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printQuantities, setPrintQuantities] = useState<Record<string, number>>({});

  // New Product Form
  const [newProduct, setNewProduct] = useState({
    name: '',
    barcode: '',
    description: '',
    size: '',
    purchase_price: 0,
    sale_price: 0,
    price: 0,
    stock: 0,
    category: 'Uniforme',
    min_stock: 0,
    max_stock: 0
  });

  const generateBarcode = () => {
    // Generate a 13-digit numeric string
    return Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
  };

  // New Demand Form
  const [newDemand, setNewDemand] = useState({
    title: '',
    description: '',
    priority: 'Média',
    status: 'Pendente'
  });

  useEffect(() => {
    if (!user || authLoading) return;

    fetchData();

    // Set up real-time subscriptions
    const productsSubscription = supabase
      .channel('products_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
      .subscribe();

    const transactionsSubscription = supabase
      .channel('transactions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_transactions' }, () => fetchData())
      .subscribe();

    const demandsSubscription = supabase
      .channel('demands_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lojinha_demands' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(productsSubscription);
      supabase.removeChannel(transactionsSubscription);
      supabase.removeChannel(demandsSubscription);
    };
  }, [user, authLoading]);

  const fetchData = async () => {
    const { data: prods } = await supabase.from('products').select('*').order('name');
    if (prods) setProducts(prods);

    const { data: trans } = await supabase
      .from('stock_transactions')
      .select('*, products(name, size)')
      .order('created_at', { ascending: false });
    if (trans) setTransactions(trans);

    const { data: dems } = await supabase
      .from('lojinha_demands')
      .select('*')
      .order('created_at', { ascending: false });
    if (dems) setDemands(dems);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const barcode = newProduct.barcode || generateBarcode();

      const productToInsert = {
        name: newProduct.name,
        barcode,
        size: newProduct.size,
        purchase_price: newProduct.purchase_price || 0,
        sale_price: newProduct.sale_price || newProduct.price || 0,
        price: newProduct.sale_price || newProduct.price || 0,
        stock: newProduct.stock || 0,
        category: newProduct.category,
        description: newProduct.description,
        min_stock: newProduct.min_stock || 5,
        max_stock: newProduct.max_stock || 50
      };

      const { error } = await supabase.from('products').insert([productToInsert]);
      if (error) throw error;
      
      setIsAddModalOpen(false);
      setNewProduct({ 
        name: '', 
        barcode: '', 
        description: '',
        size: '',
        purchase_price: 0,
        sale_price: 0,
        price: 0, 
        stock: 0, 
        category: 'Uniforme',
        min_stock: 0,
        max_stock: 0
      });
      setActiveTab('estoque');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar produto. Verifique se todos os campos estão corretos.');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: newProduct.name,
          barcode: newProduct.barcode,
          size: newProduct.size,
          purchase_price: newProduct.purchase_price,
          sale_price: newProduct.sale_price || newProduct.price,
          price: newProduct.sale_price || newProduct.price,
          category: newProduct.category,
          description: newProduct.description,
          min_stock: newProduct.min_stock,
          max_stock: newProduct.max_stock
        })
        .eq('id', selectedProduct.id);
      
      if (error) throw error;
      
      setIsAddModalOpen(false);
      setIsEditing(false);
      setSelectedProduct(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar produto.');
    }
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockQuantity, setRestockQuantity] = useState(0);
  const [showRestockSuggest, setShowRestockSuggest] = useState(false);
  const [lastRestockedItem, setLastRestockedItem] = useState<{product: Product, quantity: number} | null>(null);

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({
          stock: (selectedProduct.stock || 0) + restockQuantity
        })
        .eq('id', selectedProduct.id);
      
      if (error) throw error;
      
      // Log transaction
      await supabase.from('stock_transactions').insert([{
        product_id: selectedProduct.id,
        quantity: restockQuantity,
        type: 'in',
        user_id: profile?.id
      }]);

      setLastRestockedItem({ product: selectedProduct, quantity: restockQuantity });
      setIsRestockModalOpen(false);
      setRestockQuantity(0);
      setShowRestockSuggest(true);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao renovar estoque.');
    }
  };

  const printSpecificLabels = (product: Product, quantity: number) => {
    setSelectedProductIds(new Set([product.id]));
    setPrintQuantities({ [product.id]: Math.min(product.stock, quantity) });
    setShowRestockSuggest(false);
    window.print();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este produto? Todo o histórico de movimentação também será removido.')) return;
    console.log('Iniciando exclusão do produto:', id);
    try {
      // 1. Limpar demandas vinculadas (Opcional, lidando com possível falta da coluna)
      try {
        const { error: demError } = await supabase.from('lojinha_demands').delete().eq('product_id', id);
        if (demError && demError.message.includes('column "product_id" does not exist')) {
          console.warn('Tabela lojinha_demands não possui product_id. Pulando limpeza de demandas.');
        } else if (demError) {
          console.error('Erro ao limpar demandas:', demError);
        }
      } catch (e) {
        console.warn('Erro ao tentar deletar de lojinha_demands:', e);
      }

      // 2. Limpar transações de estoque vinculadas
      const { error: transError } = await supabase.from('stock_transactions').delete().eq('product_id', id);
      if (transError) {
        console.error('Erro ao limpar transações:', transError);
        alert('Erro ao limpar histórico: ' + transError.message);
        return;
      }
      
      // 3. Deletar o produto
      const { error: prodError } = await supabase.from('products').delete().eq('id', id);
      
      if (prodError) {
        console.error('Erro ao excluir produto:', prodError);
        alert('Erro ao excluir produto: ' + prodError.message);
        return;
      }
      
      console.log('Produto excluído com sucesso do banco de dados');
      await fetchData();
      alert('Produto e histórico removidos com sucesso.');
    } catch (err) {
      console.error('Exceção ao excluir:', err);
      alert('Ocorreu um erro inesperado ao excluir o produto.');
    }
  };

  const handleAddDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('lojinha_demands').insert([{
        ...newDemand,
        user_id: profile?.id,
        user_name: profile?.display_name
      }]);
      if (error) throw error;

      setIsDemandModalOpen(false);
      setNewDemand({ title: '', description: '', priority: 'Média', status: 'Pendente' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const newStock = stockAction === 'entry' 
      ? selectedProduct.stock + quantity 
      : selectedProduct.stock - quantity;

    try {
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', selectedProduct.id);
      
      if (updateError) throw updateError;

      const { error: transError } = await supabase
        .from('stock_transactions')
        .insert([{
          product_id: selectedProduct.id,
          type: stockAction,
          quantity,
          user_id: profile?.id,
          notes: `Ajuste manual de estoque (${stockAction})`
        }]);
      
      if (transError) throw transError;

      // Automatic Demand Logic: If stock becomes negative or zero, create a demand
      if (stockAction === 'exit' && newStock <= (selectedProduct.min_stock || 0)) {
        const { error: demandError } = await supabase
          .from('lojinha_demands')
          .insert([{
            product_id: selectedProduct.id,
            title: `Reposição Urgente: ${selectedProduct.name}${selectedProduct.size ? ` (${selectedProduct.size})` : ''}`,
            description: `O estoque atingiu ${newStock} unidades (Mínimo: ${selectedProduct.min_stock || 0}). Necessário realizar compra para atender demanda.`,
            priority: newStock < 0 ? 'Alta' : 'Média',
            status: 'Pendente',
            user_id: profile?.id,
            user_name: 'Sistema (Automático)'
          }]);
        
        if (demandError) console.error('Erro ao criar demanda automática:', demandError);
      }

      setIsStockModalOpen(false);
      setQuantity(1);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput) return;
    
    const product = products.find(p => p.barcode === scanInput);
    if (product) {
      setScannedItems(prev => ({
        ...prev,
        [product.barcode]: (prev[product.barcode] || 0) + 1
      }));
    } else {
      alert('Produto não encontrado!');
    }
    setScanInput('');
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode.includes(searchTerm)
  );

  const isUserLojinha = profile?.role === 'user_lojinha';

  const allTabs = [
    { id: 'estoque', label: 'Estoque', icon: Package },
    { id: 'conferencia', label: 'Conferência', icon: BarcodeIcon },
    { id: 'cadastros', label: 'Cadastros', icon: Plus },
    { id: 'movimentacao', label: 'Movimentação', icon: History },
    { id: 'pagvendas', label: 'PagVendas', icon: CreditCard },
    { id: 'relatorios', label: 'Relatórios', icon: FileText },
    { id: 'demandas', label: 'Demandas', icon: ShoppingBag },
    { id: 'configuracoes', label: 'Acesso', icon: Settings },
  ];

  const tabs = isUserLojinha 
    ? allTabs.filter(t => !['cadastros', 'relatorios', 'configuracoes'].includes(t.id))
    : allTabs;

  const isSaturday = new Date().getDay() === 6;
  // Simple logic: show alert every other Saturday (even weeks)
  const isStockCheckWeek = Math.floor(new Date().getDate() / 7) % 2 === 0;
  const showStockCheckAlert = isSaturday && isStockCheckWeek;

  return (
    <>
      <div className="hidden print:block p-4">
        <div className="grid grid-cols-4 gap-4">
          {products.filter(p => selectedProductIds.has(p.id)).flatMap(product => {
            const qty = printQuantities[product.id] || 1;
            return Array.from({ length: qty }).map((_, idx) => (
              <div key={`${product.id}-${idx}`} className="flex flex-col items-center p-3 border border-gray-300 rounded-lg bg-white text-black shadow-sm break-inside-avoid">
                <Logo size={48} className="mb-2" />
                <span className="font-bold text-[10px] uppercase text-center leading-tight h-8 flex flex-col items-center">
                  <span>{product.name}{product.size ? ` (${product.size})` : ''}</span>
                </span>
                <span className="font-black text-sm mb-2 text-blue-700">
                  R$ {product.price.toFixed(2)}
                </span>
                <div className="bg-white p-1 rounded">
                  <Barcode 
                    value={product.barcode} 
                    height={30} 
                    width={1.1} 
                    fontSize={8} 
                    margin={0}
                  />
                </div>
              </div>
            ));
          })}
        </div>
      </div>

      <div className="space-y-6 print:hidden">
        {showStockCheckAlert && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center text-blue-800">
            <BarcodeIcon className="w-6 h-6 mr-3 text-blue-600" />
            <div>
              <h3 className="font-bold">Lembrete de Conferência de Estoque</h3>
              <p className="text-sm text-blue-600">Hoje é sábado de conferência! Acesse a aba "Conferência" para realizar o balanço quinzenal.</p>
            </div>
          </div>
        )}

        <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">1. Sistema de Lojinha</h1>
          <p className="text-gray-500">Gestão completa de estoque e vendas.</p>
        </div>
      </header>

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center px-6 py-3 border-b-2 font-medium text-sm transition-all",
              activeTab === tab.id 
                ? "border-blue-600 text-blue-600 bg-blue-50/50" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <tab.icon size={16} className="mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'estoque' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nome ou código de barras..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                if (selectedProductIds.size === 0) {
                  alert("Por favor, selecione ao menos um produto para imprimir etiquetas.");
                  return;
                }
                const initialQty: Record<string, number> = {};
                selectedProductIds.forEach(id => {
                  const product = products.find(p => p.id === id);
                  if (product) {
                    initialQty[id] = product.stock > 0 ? 1 : 0;
                  }
                });
                setPrintQuantities(initialQty);
                setShowPrintModal(true);
              }}
              className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors"
            >
              <BarcodeIcon size={18} className="mr-2" />
              Imprimir Etiquetas {selectedProductIds.size > 0 && `(${selectedProductIds.size})`}
            </button>
          </div>

          {/* Product Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-bottom border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-10">
                    <input 
                      type="checkbox" 
                      className="rounded text-blue-600 focus:ring-blue-500"
                      checked={selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleAllSelection}
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Produto</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Código de Barras</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Preço</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estoque</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className={cn(
                    "hover:bg-gray-50 transition-colors",
                    selectedProductIds.has(product.id) && "bg-blue-50/30"
                  )}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded text-blue-600 focus:ring-blue-500"
                        checked={selectedProductIds.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{product.name}{product.size ? ` (${product.size})` : ''}</p>
                      <p className="text-xs text-gray-500">{product.category}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start">
                        <Barcode value={product.barcode} height={30} width={1} fontSize={10} />
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      R$ {product.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-bold",
                        product.stock <= (product.min_stock || 5) ? "bg-red-100 text-red-600" : 
                        (product.max_stock && product.stock >= product.max_stock) ? "bg-orange-100 text-orange-600" :
                        "bg-green-100 text-green-600"
                      )}>
                        {product.stock} un
                      </span>
                      {product.stock <= (product.min_stock || 5) && (
                        <p className="text-[10px] text-red-500 mt-1 font-bold">Estoque Baixo!</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setRestockQuantity(0);
                            setIsRestockModalOpen(true);
                          }}
                          title="Renovar Estoque"
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        >
                          <Plus size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setNewProduct({
                              name: product.name,
                              barcode: product.barcode,
                              description: product.description || '',
                              size: product.size || '',
                              purchase_price: product.purchase_price || 0,
                              sale_price: product.sale_price || product.price || 0,
                              price: product.price || 0,
                              stock: product.stock,
                              category: product.category,
                              min_stock: product.min_stock || 0,
                              max_stock: product.max_stock || 0
                            });
                            setIsEditing(true);
                            setIsAddModalOpen(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setStockAction('entry');
                            setIsStockModalOpen(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Entrada"
                        >
                          <ArrowDownLeft size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setStockAction('exit');
                            setIsStockModalOpen(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Saída"
                        >
                          <ArrowUpRight size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProductIds(new Set([product.id]));
                            setPrintQuantities({ [product.id]: product.stock > 0 ? 1 : 0 });
                            setShowPrintModal(true);
                          }}
                          className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"
                          title="Imprimir Etiqueta"
                        >
                          <BarcodeIcon size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'conferencia' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4">Conferência de Estoque (Balanço)</h2>
            <p className="text-gray-500 mb-6">
              Escaneie os códigos de barras dos produtos físicos. O sistema comparará com o estoque atual.
            </p>
            
            <form onSubmit={handleScan} className="flex gap-4 mb-8">
              <div className="relative flex-1">
                <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  autoFocus
                  placeholder="Escaneie o código de barras aqui..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
              >
                Registrar
              </button>
            </form>

            <div className="overflow-hidden border border-gray-200 rounded-xl">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Produto</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estoque Sistema</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contagem Física</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Diferença</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((product) => {
                    const scannedCount = scannedItems[product.barcode] || 0;
                    const diff = scannedCount - product.stock;
                    const isOk = diff === 0;
                    
                    return (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.barcode}</p>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-500">{product.stock}</td>
                        <td className="px-6 py-4 font-bold text-blue-600">{scannedCount}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "font-bold",
                            diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-400"
                          )}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {scannedCount === 0 ? (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Pendente</span>
                          ) : isOk ? (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-600">OK</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600">Divergente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setScannedItems({})}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
              >
                Zerar Contagem
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cadastros' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-6">Ingestão de Dados Cadastrais</h2>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tamanho</label>
                  <input 
                    type="text"
                    placeholder="Ex: P, M, G, 42..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.size}
                    onChange={(e) => setNewProduct({...newProduct, size: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  >
                    <option>Uniforme</option>
                    <option>Distintivo</option>
                    <option>Acessório</option>
                    <option>Outros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor de Compra (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="Opcional"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.purchase_price || ''}
                    onChange={(e) => setNewProduct({...newProduct, purchase_price: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor de Venda (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="Opcional"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.sale_price || ''}
                    onChange={(e) => setNewProduct({...newProduct, sale_price: parseFloat(e.target.value), price: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Gerado automaticamente se vazio"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={() => setNewProduct({...newProduct, barcode: generateBarcode()})}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <BarcodeIcon size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                  <input 
                    type="number"
                    placeholder="Opcional (Padrão 0)"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.stock || ''}
                    onChange={(e) => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mín.</label>
                  <input 
                    type="number"
                    placeholder="Opcional"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.min_stock || ''}
                    onChange={(e) => setNewProduct({...newProduct, min_stock: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Máx.</label>
                  <input 
                    type="number"
                    placeholder="Opcional"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.max_stock || ''}
                    onChange={(e) => setNewProduct({...newProduct, max_stock: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                Cadastrar Material
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'pagvendas' && (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-4">Integração PagVendas</h2>
            <p className="text-gray-500 mb-8">
              Conecte sua conta PagVendas para sincronizar vendas automaticamente e atualizar o estoque em tempo real.
            </p>
            <button className="px-8 py-3 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 transition-all">
              Configurar Token de API
            </button>
          </div>
        </div>
      )}

      {activeTab === 'movimentacao' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">Histórico de Entradas e Saídas</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Produto</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Qtd</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => {
                  const product = products.find(p => p.id === t.productId);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {t.created_at ? format(new Date(t.created_at), 'dd/MM/yyyy HH:mm') : 'Pendente'}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {t.products?.name}{t.products?.size ? ` (${t.products.size})` : ''}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          t.type === 'entry' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                        )}>
                          {t.type === 'entry' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold">
                        {t.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {t.userName || 'Sistema'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'demandas' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Cadastro de Novas Demandas</h2>
            <button 
              onClick={() => setIsDemandModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={18} className="mr-2" /> Nova Demanda
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {demands.map((demand) => (
              <div key={demand.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                    demand.priority === 'Alta' ? "bg-red-100 text-red-600" : 
                    demand.priority === 'Média' ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"
                  )}>
                    {demand.priority}
                  </span>
                  <span className="text-xs text-gray-400">
                    {demand.created_at ? format(new Date(demand.created_at), 'dd/MM') : ''}
                  </span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">{demand.title}</h4>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{demand.description}</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <span className="text-xs font-medium text-gray-400">Status: {demand.status}</span>
                  <button className="text-blue-600 text-xs font-bold hover:underline">Ver Detalhes</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'configuracoes' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-6">Controle de Acesso e Funções</h2>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="font-bold mb-2">Segregação de Funções</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Defina quais usuários podem realizar entradas, saídas e cadastros de novos materiais.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <span className="text-sm font-medium">Administrador</span>
                    <span className="text-xs text-green-600 font-bold">Acesso Total</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <span className="text-sm font-medium">Operador de Estoque</span>
                    <span className="text-xs text-blue-600 font-bold">Entradas/Saídas</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <span className="text-sm font-medium">Vendedor</span>
                    <span className="text-xs text-yellow-600 font-bold">Apenas Vendas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {/* ... existing modals ... */}
      
      {/* Restock Label Suggestion Modal */}
      {showRestockSuggest && lastRestockedItem && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right-4 duration-300">
          <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 p-6 max-w-sm w-full">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                <BarcodeIcon size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">Estoque Atualizado!</h3>
                <p className="text-sm text-gray-500">
                  Deseja imprimir <strong>{lastRestockedItem.quantity}</strong> etiquetas para <strong>{lastRestockedItem.product.name}{lastRestockedItem.product.size ? ` (${lastRestockedItem.product.size})` : ''}</strong> agora?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRestockSuggest(false)}
                className="flex-1 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg"
              >
                Agora não
              </button>
              <button 
                onClick={() => printSpecificLabels(lastRestockedItem.product, lastRestockedItem.quantity)}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8">
            <h2 className="text-xl font-bold mb-2">Renovar Estoque</h2>
            <p className="text-sm text-gray-500 mb-6">{selectedProduct?.name}{selectedProduct?.size ? ` (${selectedProduct.size})` : ''}</p>
            
            <form onSubmit={handleRestock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de Entrada</label>
                <input 
                  required
                  autoFocus
                  type="number"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-lg font-bold"
                  value={restockQuantity || ''}
                  onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Estoque atual: <span className="font-bold">{selectedProduct?.stock}</span> → Novo estoque: <span className="font-bold text-green-600">{(selectedProduct?.stock || 0) + restockQuantity}</span>
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                >
                  Confirmar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-8 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-6">{isEditing ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h2>
            <form onSubmit={isEditing ? handleUpdateProduct : handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tamanho</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.size}
                    onChange={(e) => setNewProduct({...newProduct, size: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  >
                    <option>Uniforme</option>
                    <option>Distintivo</option>
                    <option>Acessório</option>
                    <option>Outros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor de Compra (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.purchase_price || ''}
                    onChange={(e) => setNewProduct({...newProduct, purchase_price: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor de Venda (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.sale_price || newProduct.price || ''}
                    onChange={(e) => setNewProduct({...newProduct, sale_price: parseFloat(e.target.value), price: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
                <div className="relative">
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={() => setNewProduct({...newProduct, barcode: generateBarcode()})}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <BarcodeIcon size={18} />
                  </button>
                </div>
              </div>

              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.stock || ''}
                    onChange={(e) => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.min_stock || ''}
                    onChange={(e) => setNewProduct({...newProduct, min_stock: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Máximo</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.max_stock || ''}
                    onChange={(e) => setNewProduct({...newProduct, max_stock: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditing(false);
                  }}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                >
                  {isEditing ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Update Modal */}
      {isStockModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8">
            <h2 className="text-xl font-bold mb-2">
              {stockAction === 'entry' ? 'Entrada de Estoque' : 'Saída de Estoque'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">{selectedProduct.name}{selectedProduct.size ? ` (${selectedProduct.size})` : ''}</p>
            <form onSubmit={handleStockUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input 
                  required
                  type="number"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-center text-2xl font-bold"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className={cn(
                    "flex-1 py-2 text-white rounded-lg text-sm font-medium",
                    stockAction === 'entry' ? "bg-blue-600" : "bg-red-600"
                  )}
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Demand Modal */}
      {isDemandModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6">Cadastrar Nova Demanda</h2>
            <form onSubmit={handleAddDemand} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título da Demanda</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newDemand.title}
                  onChange={(e) => setNewDemand({...newDemand, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Detalhada</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newDemand.description}
                  onChange={(e) => setNewDemand({...newDemand, description: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                <select 
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newDemand.priority}
                  onChange={(e) => setNewDemand({...newDemand, priority: e.target.value})}
                >
                  <option>Baixa</option>
                  <option>Média</option>
                  <option>Alta</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsDemandModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                >
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Print Quantity Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-900 flex items-center">
                <BarcodeIcon className="mr-2 h-5 w-5 text-gray-400" />
                Quantidade de Etiquetas
              </h2>
              <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              <p className="text-sm text-gray-500 mb-4">
                Defina a quantidade de etiquetas que deseja imprimir para cada produto selecionado.
              </p>
              {products.filter(p => selectedProductIds.has(p.id)).map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-900">{product.name} {product.size ? `(${product.size})` : ''}</p>
                    <p className="text-xs text-gray-500">{product.barcode} • R$ {product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPrintQuantities(prev => ({...prev, [product.id]: Math.max(0, (prev[product.id] || 0) - 1)}))}
                      disabled={(printQuantities[product.id] || 0) <= 0}
                      className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-bold text-sm">{printQuantities[product.id] || 0}</span>
                    <button 
                      onClick={() => setPrintQuantities(prev => ({...prev, [product.id]: Math.min(product.stock, (prev[product.id] || 0) + 1)}))}
                      disabled={(printQuantities[product.id] || 0) >= product.stock}
                      className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const checkHasTags = products.filter(p => selectedProductIds.has(p.id)).reduce((acc, p) => acc + (printQuantities[p.id] || 0), 0);
                  if (checkHasTags === 0) {
                      alert("A quantidade total de etiquetas não pode ser zero.");
                      return;
                  }
                  window.print();
                  setShowPrintModal(false);
                }}
                className="flex-1 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-medium transition-colors flex items-center justify-center"
              >
                <BarcodeIcon className="h-4 w-4 mr-2" />
                Imprimir agora
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
};

export default Lojinha;
