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
  Settings
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import Barcode from 'react-barcode';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface Product {
  id: string;
  barcode: string;
  name: string;
  price: number;
  stock: number;
  category: string;
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
  const [stockAction, setStockAction] = useState<'entry' | 'exit'>('entry');
  const [quantity, setQuantity] = useState(1);
  const [scannedItems, setScannedItems] = useState<Record<string, number>>({});
  const [scanInput, setScanInput] = useState('');

  // New Product Form
  const [newProduct, setNewProduct] = useState({
    name: '',
    barcode: '',
    price: 0,
    stock: 0,
    category: 'Uniforme'
  });

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
      .select('*, products(name)')
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
      const { error } = await supabase.from('products').insert([newProduct]);
      if (error) throw error;
      
      setIsAddModalOpen(false);
      setNewProduct({ name: '', barcode: '', price: 0, stock: 0, category: 'Uniforme' });
      setActiveTab('estoque');
      fetchData();
    } catch (err) {
      console.error(err);
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
      <div className="hidden print:block p-8">
        <h1 className="text-2xl font-bold mb-8 text-center">Etiquetas de Produtos - Lojinha</h1>
        <div className="grid grid-cols-3 gap-8">
          {filteredProducts.map(product => (
            <div key={product.id} className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-400 rounded-lg">
              <span className="font-bold text-sm mb-2 text-center">{product.name}</span>
              <Barcode value={product.barcode} height={40} width={1.5} fontSize={12} />
            </div>
          ))}
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
              onClick={() => window.print()}
              className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors"
            >
              <BarcodeIcon size={18} className="mr-2" />
              Imprimir Etiquetas
            </button>
          </div>

          {/* Product Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-bottom border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Produto</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Código de Barras</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Preço</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estoque</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{product.name}</p>
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
                        product.stock < 5 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                      )}>
                        {product.stock} un
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Material/Produto</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras (EAN)</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda (R$)</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                  <input 
                    required
                    type="number"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: parseInt(e.target.value)})}
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
                        {t.products?.name || 'Produto Removido'}
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
      
      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6">Cadastrar Novo Produto</h2>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                  <input 
                    required
                    type="number"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                >
                  Salvar
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
            <p className="text-sm text-gray-500 mb-6">{selectedProduct.name}</p>
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
    </div>
    </>
  );
};

export default Lojinha;
