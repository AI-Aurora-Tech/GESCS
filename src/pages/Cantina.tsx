import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  FileText,
  DollarSign,
  Filter,
  Download,
  History,
  Settings,
  CreditCard,
  Pencil,
  Trash2,
  ChefHat
} from 'lucide-react';
import { supabase } from '../supabase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../AuthContext';

interface FinancialRecord {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  is_extraordinary: boolean;
}

const Cantina: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'financeiro' | 'pdv_cantina' | 'materiais' | 'receitas' | 'margem' | 'banco' | 'movimentacao' | 'relatorios' | 'configuracoes'>('financeiro');
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [productionQuantity, setProductionQuantity] = useState(1);
  
  // Cantina / PDV Checkout state variables
  const [cantinaCart, setCantinaCart] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [cantinaTerminalIp, setCantinaTerminalIp] = useState(localStorage.getItem('cantina_terminal_ip') || 'localhost:1337');
  const [cantinaPaymentStatus, setCantinaPaymentStatus] = useState<'idle' | 'sending' | 'waiting' | 'approved' | 'failed'>('idle');
  const [cantinaPaymentError, setCantinaPaymentError] = useState('');
  const [cantinaActivePaymentMethod, setCantinaActivePaymentMethod] = useState<'credit_card' | 'debit_card' | 'pix' | 'cash'>('credit_card');
  const [cantinaCurrentTransactionRef, setCantinaCurrentTransactionRef] = useState('');
  const [cantinaModalAmount, setCantinaModalAmount] = useState<number>(0);
  const [cantinaSearchTerm, setCantinaSearchTerm] = useState('');

  const addCantinaCart = (item: any) => {
    setCantinaCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const removeCantinaCart = (id: string) => {
    setCantinaCart(prev => prev.filter(i => i.id !== id));
  };

  const updateCantinaQuantity = (id: string, val: number) => {
    setCantinaCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + val) };
      }
      return item;
    }));
  };

  const getCantinaCartTotal = () => {
    return cantinaCart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  };

  const completeCantinaSale = async (ref: string, methodStr: string) => {
    if (cantinaCart.length === 0) {
      setCantinaPaymentStatus('approved');
      return;
    }
    try {
      const totalAmount = getCantinaCartTotal();
      const itemsText = cantinaCart.map(i => `${i.quantity}x ${i.name}`).join(', ');

      // 1. Decrement materials stock inside `cantina_materials` table
      for (const item of cantinaCart) {
        const { data: matData } = await supabase
          .from('cantina_materials')
          .select('stock')
          .eq('id', item.id)
          .single();

        if (matData) {
          const newStock = Math.max(0, matData.stock - item.quantity);
          await supabase
            .from('cantina_materials')
            .update({ stock: newStock })
            .eq('id', item.id);
        }
      }

      // 2. Insert into `financial_records` inside Supabase
      const fullDesc = `PDV Cantina: ${itemsText} - Ref #${ref} (${methodStr === 'cash' ? 'Dinheiro' : 'PagBank'})`;
      await supabase.from('financial_records').insert([{
        type: 'income',
        amount: totalAmount,
        category: 'Venda Cantina',
        description: fullDesc,
        module: 'cantina',
        branch: 'Grupo',
        date: new Date().toISOString()
      }]);

      setCantinaPaymentStatus('approved');
      setCantinaCart([]);
      fetchRecords();
      fetchMaterials();
    } catch (err: any) {
      console.error("Erro ao registrar a conclusão da venda Cantina:", err);
      setCantinaPaymentError(err.message || 'Erro ao persistir a venda.');
      setCantinaPaymentStatus('failed');
    }
  };

  const handleCantinaCheckout = async () => {
    if (cantinaCart.length === 0) return;
    const total = getCantinaCartTotal();
    const reference = `CT-${Date.now().toString().slice(-6)}`;
    setCantinaCurrentTransactionRef(reference);
    setCantinaPaymentError('');

    if (cantinaActivePaymentMethod === 'cash') {
      setCantinaPaymentStatus('sending');
      await completeCantinaSale(reference, 'cash');
    } else {
      setCantinaPaymentStatus('sending');
      try {
        localStorage.setItem('cantina_terminal_ip', cantinaTerminalIp);
        setCantinaModalAmount(total);
        
        try {
          await fetch('/api/pagbank/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: total,
              reference,
              items: cantinaCart.map(i => ({
                name: i.name,
                quantity: i.quantity,
                price: i.price
              })),
              module: 'cantina',
              paymentMethod: cantinaActivePaymentMethod,
              terminalIp: cantinaTerminalIp
            })
          });
        } catch (apiError) {
          console.warn("PagBank cloud registration failed but local Cantina tracking is success:", apiError);
        }

        setCantinaPaymentStatus('waiting');

        try {
          fetch(`http://${cantinaTerminalIp}/api/v1/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify({
              amount: Math.round(total * 100),
              paymentMethod: cantinaActivePaymentMethod === 'debit_card' ? 2 : 1,
              installments: 1,
              userReference: reference
            })
          }).then(async (localRes) => {
            const localResult = await localRes.json();
            if (localResult.success || localResult.status === 'APPROVED') {
              await completeCantinaSale(reference, 'PagBank');
            }
          }).catch(e => {
            console.warn("Direct native PlugPag connection inactive, falling back to cantina simulator.");
          });
        } catch (localErr) {
          console.warn("Local network dispatch exception:", localErr);
        }
      } catch (err: any) {
        console.error("Erro ao processar PagBank Cantina:", err);
        setCantinaPaymentStatus('failed');
        setCantinaPaymentError(err.message || 'Falha ao processar checkout.');
      }
    }
  };
  
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    stock: 0,
    unit: 'un',
    unit_cost: 0
  });
  const [newIngredientStockStr, setNewIngredientStockStr] = useState('');
  const [newIngredientCostStr, setNewIngredientCostStr] = useState('');

  const [newRecipe, setNewRecipe] = useState({
    name: '',
    ingredients: [] as { ingredient_id: string, quantity: number }[]
  });
  const [recipeIngredientId, setRecipeIngredientId] = useState('');
  const [recipeIngredientQty, setRecipeIngredientQty] = useState('');
  const [newRecord, setNewRecord] = useState({
    type: 'income' as 'income' | 'expense',
    amount: 0,
    category: 'Venda Direta',
    description: '',
    is_extraordinary: false
  });
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string>('');

  const [newMaterial, setNewMaterial] = useState({
    name: '',
    category: 'Salgados',
    price: 0,
    stock: 0
  });

  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

  const extractAttachment = (desc: string) => {
    if (!desc) return { cleanDescription: '', attachment: null };
    const match = desc.match(/\[ANEXO_NF:(.*?)\]/);
    if (match) {
      const cleanDescription = desc.replace(/\s*\[ANEXO_NF:.*?\]/, '');
      return { cleanDescription, attachment: match[1] };
    }
    return { cleanDescription: desc, attachment: null };
  };

  const [errorState, setErrorState] = useState<Record<string, boolean>>({});

  const fetchIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from('cantina_ingredients')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        if (error.code === 'PGRST204') {
          setErrorState(prev => ({ ...prev, ingredients: true }));
        }
        console.error(error);
      } else {
        setIngredients(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from('cantina_recipes')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        if (error.code === 'PGRST204') {
          setErrorState(prev => ({ ...prev, recipes: true }));
        }
        console.error(error);
      } else {
        setRecipes(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [marginCalc, setMarginCalc] = useState({
    cost: 0,
    markup: 30, // %
    others: 0
  });

  const [foodBank, setFoodBank] = useState<any[]>([]);
  const [isFoodBankModalOpen, setIsFoodBankModalOpen] = useState(false);
  const [newFoodBankItem, setNewFoodBankItem] = useState({
    name: '',
    quantity: '',
    unit: 'un',
    expiry_date: ''
  });

  const handleAddFoodBankLot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedQuantity = parseFloat(newFoodBankItem.quantity.replace(/\./g, '').replace(',', '.')) || 0;
      const payload = {
        name: newFoodBankItem.name,
        quantity: parsedQuantity,
        unit: newFoodBankItem.unit,
        expiry_date: newFoodBankItem.expiry_date
      };
      
      const { error } = await supabase.from('cantina_food_bank').insert([payload]);
      if (error) {
        console.warn("Table cantina_food_bank insert failed, fallback to local state:", error);
        const localItem = {
          id: Math.random().toString(36).substring(2),
          ...payload
        };
        setFoodBank(prev => [...prev, localItem].sort((a,b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()));
      } else {
        fetchFoodBank();
      }

      setIsFoodBankModalOpen(false);
      setNewFoodBankItem({ name: '', quantity: '', unit: 'un', expiry_date: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFoodBankLot = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este lote?")) return;
    try {
      const { error } = await supabase.from('cantina_food_bank').delete().eq('id', id);
      if (error) {
        setFoodBank(prev => prev.filter(item => item.id !== id));
      } else {
        fetchFoodBank();
      }
    } catch (err) {
      console.error(err);
      setFoodBank(prev => prev.filter(item => item.id !== id));
    }
  };

  const fetchFoodBank = async () => {
    try {
      const { data, error } = await supabase.from('cantina_food_bank').select('*').order('expiry_date', { ascending: true });
      if (error) {
        if (error.code === 'PGRST204') {
          setErrorState(prev => ({ ...prev, foodBank: true }));
        }
        throw error;
      }
      setFoodBank(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!user || authLoading) return;

    fetchRecords();
    fetchMaterials();
    fetchIngredients();
    fetchRecipes();
    fetchFoodBank();

    const recordsSubscription = supabase
      .channel('records_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_records' }, () => fetchRecords())
      .subscribe();

    const materialsSubscription = supabase
      .channel('materials_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cantina_materials' }, () => fetchMaterials())
      .subscribe();

    const ingredientsSubscription = supabase
      .channel('ingredients_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cantina_ingredients' }, () => fetchIngredients())
      .subscribe();

    return () => {
      supabase.removeChannel(recordsSubscription);
      supabase.removeChannel(materialsSubscription);
      supabase.removeChannel(ingredientsSubscription);
    };
  }, [user, authLoading]);

  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
      .order('date', { ascending: false });
    
    if (data) setRecords(data);
    if (error) console.error(error);
  };

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from('cantina_materials')
      .select('*')
      .order('name', { ascending: true });
    
    if (data) setMaterials(data);
    if (error) console.error(error);
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalDescription = newRecord.description;
      if (attachedFile) {
        finalDescription += ` [ANEXO_NF:${attachedFile}]`;
      }

      const { error } = await supabase.from('financial_records').insert([{
        ...newRecord,
        description: finalDescription
      }]);
      if (error) throw error;
      
      setIsModalOpen(false);
      setNewRecord({ type: 'income', amount: 0, category: 'Venda Direta', description: '', is_extraordinary: false });
      setAttachedFile(null);
      setAttachedFileName('');
      fetchRecords();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao lançar financeiro: ${err?.message || 'Verifique as regras do banco de dados (RLS).'}`);
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('cantina_materials').insert([newMaterial]);
      if (error) throw error;
      
      setIsMaterialModalOpen(false);
      setNewMaterial({ name: '', category: 'Salgados', price: 0, stock: 0 });
      fetchMaterials();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao cadastrar material/produto: ${err?.message || 'Verifique as regras do banco de dados (RLS).'}`);
    }
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedStock = parseFloat(newIngredientStockStr.replace(/\./g, '').replace(',', '.')) || 0;
      const parsedCost = parseFloat(newIngredientCostStr.replace(/\./g, '').replace(',', '.')) || 0;
      const payload = {
        name: newIngredient.name,
        unit: newIngredient.unit,
        stock: parsedStock,
        unit_cost: parsedCost
      };
      const { error } = await supabase.from('cantina_ingredients').insert([payload]);
      if (error) throw error;
      setIsIngredientModalOpen(false);
      setNewIngredient({ name: '', stock: 0, unit: 'un', unit_cost: 0 });
      setNewIngredientStockStr('');
      setNewIngredientCostStr('');
      fetchIngredients();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao cadastrar ingrediente: ${err?.message || 'Verifique as regras do banco de dados (RLS).'}`);
    }
  };

  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('cantina_recipes').insert([newRecipe]);
      if (error) throw error;
      setIsRecipeModalOpen(false);
      setNewRecipe({ name: '', ingredients: [] });
      fetchRecipes();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao cadastrar receita: ${err?.message || 'Verifique as regras do banco de dados (RLS).'}`);
    }
  };

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipe) return;

    try {
      // 1. Check if enough ingredients
      for (const req of selectedRecipe.ingredients) {
        const ing = ingredients.find(i => i.id === req.ingredient_id);
        if (!ing || ing.stock < (req.quantity * productionQuantity)) {
          alert(`Estoque insuficiente de ${ing?.name || 'ingrediente'}`);
          return;
        }
      }

      // 2. Subtract ingredients
      for (const req of selectedRecipe.ingredients) {
        const ing = ingredients.find(i => i.id === req.ingredient_id);
        const { error } = await supabase
          .from('cantina_ingredients')
          .update({ stock: ing.stock - (req.quantity * productionQuantity) })
          .eq('id', ing.id);
        if (error) throw error;
      }

      // 3. Add to materials stock (if same name exists)
      const material = materials.find(m => m.name === selectedRecipe.name);
      if (material) {
        const { error } = await supabase
          .from('cantina_materials')
          .update({ stock: material.stock + productionQuantity })
          .eq('id', material.id);
        if (error) throw error;
      }

      setIsProductionModalOpen(false);
      setProductionQuantity(1);
      fetchIngredients();
      fetchMaterials();
      alert('Produção concluída com sucesso!');
    } catch (err) {
      console.error(err);
    }
  };

  const [isEditIngredientModalOpen, setIsEditIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<any>(null);
  const [editIngredientStockStr, setEditIngredientStockStr] = useState('');
  const [editIngredientCostStr, setEditIngredientCostStr] = useState('');

  const [isEditRecipeModalOpen, setIsEditRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const [editRecipeIngredientId, setEditRecipeIngredientId] = useState('');
  const [editRecipeIngredientQty, setEditRecipeIngredientQty] = useState('');

  const handleOpenEditIngredient = (ing: any) => {
    setEditingIngredient(ing);
    setEditIngredientStockStr(String(ing.stock));
    setEditIngredientCostStr(String(ing.unit_cost));
    setIsEditIngredientModalOpen(true);
  };

  const handleUpdateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient) return;
    try {
      const parsedStock = parseFloat(editIngredientStockStr.replace(/\./g, '').replace(',', '.')) || 0;
      const parsedCost = parseFloat(editIngredientCostStr.replace(/\./g, '').replace(',', '.')) || 0;
      const { error } = await supabase
        .from('cantina_ingredients')
        .update({
          name: editingIngredient.name,
          unit: editingIngredient.unit,
          stock: parsedStock,
          unit_cost: parsedCost
        })
        .eq('id', editingIngredient.id);
      if (error) throw error;
      setIsEditIngredientModalOpen(false);
      setEditingIngredient(null);
      fetchIngredients();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao atualizar ingrediente: ${err?.message}`);
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este ingrediente?")) return;
    try {
      const { error } = await supabase
        .from('cantina_ingredients')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchIngredients();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao deletar ingrediente: ${err?.message}`);
    }
  };

  const handleOpenEditRecipe = (rec: any) => {
    setEditingRecipe({
      ...rec,
      ingredients: rec.ingredients || []
    });
    setEditRecipeIngredientId('');
    setEditRecipeIngredientQty('');
    setIsEditRecipeModalOpen(true);
  };

  const handleUpdateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipe) return;
    try {
      const { error } = await supabase
        .from('cantina_recipes')
        .update({
          name: editingRecipe.name,
          ingredients: editingRecipe.ingredients
        })
        .eq('id', editingRecipe.id);
      if (error) throw error;
      setIsEditRecipeModalOpen(false);
      setEditingRecipe(null);
      fetchRecipes();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao atualizar receita: ${err?.message}`);
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
    try {
      const { error } = await supabase
        .from('cantina_recipes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchRecipes();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao deletar receita: ${err?.message}`);
    }
  };

  const handleAdjustIngredient = async (ing: any) => {
    const newStock = prompt(`Ajustar estoque de ${ing.name}:`, ing.stock);
    if (newStock === null) return;
    try {
      const { error } = await supabase
        .from('cantina_ingredients')
        .update({ stock: parseFloat(newStock) })
        .eq('id', ing.id);
      if (error) throw error;
      fetchIngredients();
    } catch (err) {
      console.error(err);
    }
  };

  const totalIncome = records.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
  const balance = totalIncome - totalExpense;

  const isUserCantina = profile?.role === 'user_cantina';
  const isUserFinanceiro = profile?.role === 'user_financeiro';

  const allTabs = [
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'pdv_cantina', label: 'Frente de Caixa (PDV)', icon: CreditCard },
    { id: 'materiais', label: 'Estoque Venda', icon: Plus },
    { id: 'receitas', label: 'Receitas/Produção', icon: FileText },
    { id: 'margem', label: 'Calculadora Margem', icon: TrendingUp },
    { id: 'banco', label: 'Banco Alimentos', icon: History },
    { id: 'movimentacao', label: 'Histórico', icon: History },
    { id: 'relatorios', label: 'Relatórios', icon: FileText },
    { id: 'configuracoes', label: 'Acesso', icon: Settings },
  ];

  const tabs = (isUserCantina || isUserFinanceiro)
    ? allTabs.filter(t => !['materiais', 'relatorios', 'configuracoes'].includes(t.id))
    : allTabs;

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">2. Sistema de Cantina</h1>
          <p className="text-gray-500">Controle financeiro e de materiais da cantina.</p>
        </div>
      </header>

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-gray-200 overflow-x-auto whitespace-nowrap no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center px-4 md:px-6 py-3 border-b-2 font-medium text-sm transition-all flex-shrink-0",
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

      {activeTab === 'financeiro' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp size={24} className="text-green-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Entradas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">R$ {totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown size={24} className="text-red-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Saídas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">R$ {totalExpense.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign size={24} className="text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Atual</span>
              </div>
              <p className={cn(
                "text-2xl font-bold",
                balance >= 0 ? "text-green-600" : "text-red-600"
              )}>
                R$ {balance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Dynamic Records Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="text-lg font-bold">Lançamentos Recentes</h3>
              <div className="flex w-full md:w-auto gap-2">
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  <Plus size={18} className="mr-2" /> Novo Lançamento
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Categoria</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((record) => {
                    const parsed = extractAttachment(record.description);
                    return (
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {record.date ? format(new Date(record.date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Pendente'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center flex-wrap gap-2">
                            <p className="font-medium text-gray-900">{parsed.cleanDescription}</p>
                            {record.is_extraordinary && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-[10px] font-bold uppercase rounded-full">
                                Extraordinário
                              </span>
                            )}
                            {parsed.attachment && (
                              <button
                                onClick={() => setViewingAttachment(parsed.attachment)}
                                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold uppercase rounded-full flex items-center gap-0.5 transition-colors cursor-pointer"
                              >
                                📎 Ver NF/Recibo
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                            {record.category}
                          </span>
                        </td>
                        <td className={cn(
                          "px-6 py-4 text-right font-bold",
                          record.type === 'income' ? "text-green-600" : "text-red-600"
                        )}>
                          {record.type === 'income' ? '+' : '-'} R$ {record.amount.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pdv_cantina' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Products for Sale */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
              <div className="mb-4">
                <h3 className="text-lg font-bold">Frente de Caixa (PDV) - Cantina</h3>
                <p className="text-xs text-gray-500">Selecione os salgados, doces ou bebidas abaixo para registrar a venda.</p>
                <div className="relative mt-3">
                  <input
                    type="text"
                    placeholder="Pesquisar salgado, bebida, doce..."
                    className="w-full pl-3 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={cantinaSearchTerm}
                    onChange={(e) => setCantinaSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Materials Grid */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {materials
                  .filter(m => m.name.toLowerCase().includes(cantinaSearchTerm.toLowerCase()) || m.category.toLowerCase().includes(cantinaSearchTerm.toLowerCase()))
                  .map(mat => {
                    const inStock = mat.stock > 0;
                    return (
                      <div
                        key={mat.id}
                        onClick={() => addCantinaCart(mat)}
                        className={cn(
                          "flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:border-blue-400 transition-all",
                          inStock ? "border-gray-100 bg-gray-50/50" : "border-red-100 bg-red-50/20"
                        )}
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-900">{mat.name}</p>
                          <div className="flex items-center gap-2.5 mt-1">
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase font-bold text-[9px]">
                              {mat.category}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded",
                              inStock ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
                              Estoque: {mat.stock} un
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-gray-900">R$ {mat.price.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })}
                {materials.length === 0 && (
                  <div className="text-center py-12 text-gray-400">Nenhum material de cantina cadastrado.</div>
                )}
              </div>
            </div>

            {/* Right Column: Checkout Cart */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
              <div className="border-b border-gray-100 pb-4 mb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">Carrinho da Cantina</h3>
                  <p className="text-xs text-gray-500">Comandas e itens de compra rápida.</p>
                </div>
                {cantinaCart.length > 0 && (
                  <button
                    onClick={() => setCantinaCart([])}
                    className="text-xs font-bold text-red-500 hover:text-red-700"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Item Cart List */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                {cantinaCart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50/30">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">R$ {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCantinaQuantity(item.id, -1)}
                        className="p-1 border border-gray-200 rounded bg-white hover:bg-gray-50 font-bold"
                      >
                        -
                      </button>
                      <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCantinaQuantity(item.id, 1)}
                        className="p-1 border border-gray-200 rounded bg-white hover:bg-gray-50 font-bold"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeCantinaCart(item.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded ml-1 font-bold"
                      >
                        x
                      </button>
                    </div>
                  </div>
                ))}
                {cantinaCart.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                    <CreditCard size={40} className="mb-2 opacity-20" />
                    <p className="text-sm">Carrinho da Cantina está vazio</p>
                  </div>
                )}
              </div>

              {/* Settings & Method Checkout */}
              {cantinaCart.length > 0 && (
                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-sm font-bold text-gray-700">Subtotal:</span>
                    <span className="text-xl font-black text-gray-900">R$ {getCantinaCartTotal().toFixed(2)}</span>
                  </div>

                  {/* Terminal CONFIG */}
                  <div className="bg-amber-50/40 border border-amber-100 p-3 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase text-amber-800">IP Moderninha Smart 2 (Cantina)</label>
                      <span className="text-[9px] text-gray-400">Standard: 1337</span>
                    </div>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs"
                      placeholder="localhost:1337"
                      value={cantinaTerminalIp}
                      onChange={(e) => setCantinaTerminalIp(e.target.value)}
                    />
                  </div>

                  {/* Payment Mode Selection */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-2">Forma de Pagamento</span>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'credit_card', label: 'Crédito', sub: 'PagBank' },
                        { id: 'debit_card', label: 'Débito', sub: 'PagBank' },
                        { id: 'pix', label: 'Pix QR', sub: 'PagBank' },
                        { id: 'cash', label: 'Dinheiro', sub: 'Caixa' }
                      ].map(method => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setCantinaActivePaymentMethod(method.id as any)}
                          className={cn(
                            "p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center",
                            cantinaActivePaymentMethod === method.id 
                              ? "border-amber-500 bg-amber-50 text-amber-700 font-bold" 
                              : "border-gray-200 hover:border-gray-300 text-gray-500"
                          )}
                        >
                          <span className="text-xs">{method.label}</span>
                          <span className="text-[8px] opacity-75">{method.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checkout Action CTA */}
                  <button
                    onClick={handleCantinaCheckout}
                    className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <CreditCard size={18} /> Processar Venda Cantina (R$ {getCantinaCartTotal().toFixed(2)})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cantina POS Terminal Emulator Overlays */}
          {cantinaPaymentStatus !== 'idle' && cantinaPaymentStatus !== 'approved' && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 max-w-sm w-full text-center relative overflow-hidden">
                <div className="w-56 h-72 bg-neutral-900 border-4 border-neutral-700 rounded-[2.5rem] p-4 mx-auto shadow-2xl relative flex flex-col justify-between overflow-hidden">
                  <div className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mb-2" />
                  
                  <div className="flex-1 bg-gradient-to-b from-amber-900 to-amber-950 rounded-2xl p-4 text-white flex flex-col justify-between">
                    <div className="flex justify-between items-center text-[8px] opacity-75 mb-2 border-b border-white/10 pb-1">
                      <span>CANTINA POS</span>
                      <span>📶 Wi-Fi</span>
                    </div>
                    <p className="text-[10px] font-bold text-center opacity-90 uppercase">Cantina Escoteira</p>
                    <p className="text-xs opacity-75 text-center mt-1">Ref: {cantinaCurrentTransactionRef}</p>
                  </div>

                  <div className="text-center my-3 text-white">
                    <p className="text-xs text-amber-300 font-black uppercase">
                      {cantinaPaymentStatus === 'sending' ? 'Enviando...' : 'Aguardando Aprovação'}
                    </p>
                    <p className="text-lg font-black mt-1">R$ {(cantinaModalAmount || getCantinaCartTotal()).toFixed(2)}</p>
                  </div>

                  <div className="text-center">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-yellow-400 text-black animate-pulse">
                      Smart 2 Cantina
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2 border-t border-neutral-800">
                    <div className="w-full h-2.5 bg-neutral-800 rounded-sm" />
                    <div className="w-full h-2.5 bg-neutral-800 rounded-sm" />
                    <div className="w-full h-2.5 bg-neutral-800 rounded-sm" />
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-bold text-gray-900">Enviado para Moderninha Smart 2</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Processando comanda no terminal IP <strong>{cantinaTerminalIp}</strong>.
                  </p>
                </div>

                {/* Simulated Approval Controls */}
                <div className="mt-6 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-amber-800 uppercase">Simulador de Maquininha</p>
                  <p className="text-xs text-gray-600">
                    Aprove ou cancele a transação de cartão abaixo para simular o recebimento:
                  </p>
                  <div className="flex gap-2.5 pt-1.5">
                    <button
                      onClick={() => setCantinaPaymentStatus('idle')}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-gray-600"
                    >
                      Recusar
                    </button>
                    <button
                      onClick={async () => {
                        await completeCantinaSale(cantinaCurrentTransactionRef, 'PagBank');
                      }}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 rounded-xl text-xs font-black text-white shadow-lg shadow-amber-200"
                    >
                      Aprovar Venda
                    </button>
                  </div>
                </div>

                {cantinaPaymentError && (
                  <p className="text-xs font-bold text-red-500 mt-3">{cantinaPaymentError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'margem' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-xl font-bold mb-6">Calculadora de Margem</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custo do Produto (R$)</label>
              <input 
                type="number" 
                className="w-full px-4 py-2 border border-gray-200 rounded-lg" 
                value={marginCalc.cost} 
                onChange={e => setMarginCalc({...marginCalc, cost: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custos Fixos/Outros (R$)</label>
              <input 
                type="number" 
                className="w-full px-4 py-2 border border-gray-200 rounded-lg" 
                value={marginCalc.others} 
                onChange={e => setMarginCalc({...marginCalc, others: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Margem Desejada (%)</label>
              <input 
                type="number" 
                className="w-full px-4 py-2 border border-gray-200 rounded-lg" 
                value={marginCalc.markup} 
                onChange={e => setMarginCalc({...marginCalc, markup: parseFloat(e.target.value) || 0})}
              />
            </div>

            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 font-sans">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-blue-900">Preço de Venda Sugerido:</span>
                <span className="text-2xl font-bold text-blue-600">
                  R$ {((marginCalc.cost + marginCalc.others) * (1 + marginCalc.markup / 100)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-blue-700">
                <span>Lucro Bruto por Unidade:</span>
                <span className="font-bold">
                  R$ {((marginCalc.cost + marginCalc.others) * (marginCalc.markup / 100)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'receitas' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold">Gestão de Produção e Receitas</h2>
            <div className="flex w-full md:w-auto gap-2">
              <button 
                onClick={() => setIsIngredientModalOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                <Plus size={18} className="mr-2" /> Ingrediente
              </button>
              <button 
                onClick={() => setIsRecipeModalOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus size={18} className="mr-2" /> Receita
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-sm uppercase text-gray-500">Ingredientes em Estoque</div>
              <div className="divide-y divide-gray-100 max-h-[400px] overflow-auto">
                {errorState.ingredients ? (
                  <div className="p-8 text-center bg-yellow-50 text-yellow-800">
                    <p className="font-bold mb-1">Módulo de Ingredientes em Configuração</p>
                    <p className="text-xs">O banco de dados para ingredientes será habilitado em breve pela administração.</p>
                  </div>
                ) : (
                  <>
                    {ingredients.map(ing => (
                      <div key={ing.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="font-bold text-gray-900">{ing.name}</p>
                          <p className="text-xs text-gray-500">{ing.stock} {ing.unit} | R$ {ing.unit_cost.toFixed(2)}/{ing.unit}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleOpenEditIngredient(ing)}
                            className="text-xs px-2.5 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded font-medium transition-colors"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDeleteIngredient(ing.id)}
                            className="text-xs px-2.5 py-1 text-red-600 bg-red-50 hover:bg-red-100 rounded font-medium transition-colors"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                    {ingredients.length === 0 && <div className="p-8 text-center text-gray-400">Nenhum ingrediente cadastrado.</div>}
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-sm uppercase text-gray-500 font-sans">Receitas Disponíveis</div>
              <div className="divide-y divide-gray-100 max-h-[400px] overflow-auto">
                {errorState.recipes ? (
                  <div className="p-8 text-center bg-yellow-50 text-yellow-800">
                    <p className="font-bold mb-1">Módulo de Receitas em Configuração</p>
                    <p className="text-xs">O banco de dados para receitas será habilitado em breve pela administração.</p>
                  </div>
                ) : (
                  <>
                    {recipes.map(rec => (
                      <div key={rec.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-gray-900">{rec.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{rec.ingredients?.length || 0} ingredientes utilizados.</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => {
                                setSelectedRecipe(rec);
                                setProductionQuantity(1);
                                setIsProductionModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded uppercase transition-colors"
                            >
                              Produzir
                            </button>
                            <button 
                              onClick={() => handleOpenEditRecipe(rec)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold rounded uppercase transition-colors"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => handleDeleteRecipe(rec.id)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {recipes.length === 0 && <div className="p-8 text-center text-gray-400">Nenhuma receita cadastrada.</div>}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'banco' && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold">Banco de Alimentos</h2>
              <p className="text-sm text-gray-500">Controle de excedentes e validade.</p>
            </div>
            <button 
              onClick={() => setIsFoodBankModalOpen(true)}
              className="w-full md:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={18} className="mr-2" /> Adicionar Lote
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  <th className="px-6 py-4 font-sans">Item</th>
                  <th className="px-6 py-4 font-sans">Quantidade</th>
                  <th className="px-6 py-4 font-sans">Validade</th>
                  <th className="px-6 py-4 font-sans text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {foodBank.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium">{item.name}</td>
                    <td className="px-6 py-4 text-sm">{item.quantity} {item.unit}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {format(new Date(item.expiry_date + 'T12:00:00'), 'dd/MM/yyyy')}
                        {new Date(item.expiry_date) < new Date() && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-650 text-[10px] font-bold uppercase rounded-full">
                            Vencido
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteFoodBankLot(item.id)}
                        className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {foodBank.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                      <History size={48} className="mx-auto mb-4 opacity-10" />
                      Nenhum item no banco de alimentos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Adicionar Lote */}
          {isFoodBankModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 animate-in fade-in duration-200">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Adicionar Novo Lote</h3>
                <form onSubmit={handleAddFoodBankLot} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Item</label>
                    <input 
                      required
                      type="text"
                      placeholder="Ex: Arroz, Feijão, Macarrão..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={newFoodBankItem.name}
                      onChange={(e) => setNewFoodBankItem({...newFoodBankItem, name: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                      <input 
                        required
                        type="text"
                        placeholder="Ex: 5, 2.5..."
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        value={newFoodBankItem.quantity}
                        onChange={(e) => {
                          let val = e.target.value;
                          val = val.replace(/[^0-9,\.]/g, '');
                          setNewFoodBankItem({...newFoodBankItem, quantity: val});
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                      <select 
                        required
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        value={newFoodBankItem.unit}
                        onChange={(e) => setNewFoodBankItem({...newFoodBankItem, unit: e.target.value})}
                      >
                        <option value="un">un (Unidades)</option>
                        <option value="ML">ML (Mililitros)</option>
                        <option value="L">L (Litros)</option>
                        <option value="GR">GR (Gramas)</option>
                        <option value="KG">KG (Quilogramas)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Validade</label>
                    <input 
                      required
                      type="date"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={newFoodBankItem.expiry_date}
                      onChange={(e) => setNewFoodBankItem({...newFoodBankItem, expiry_date: e.target.value})}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsFoodBankModalOpen(false)}
                      className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                    >
                      Adicionar Lote
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'materiais' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold">Materiais e Produtos Ofertados</h2>
            <button 
              onClick={() => setIsMaterialModalOpen(true)}
              className="w-full md:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={18} className="mr-2" /> Novo Material
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {materials.map((m) => (
              <div key={m.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    {m.category}
                  </span>
                  <span className="text-xs font-bold text-gray-900">R$ {m.price.toFixed(2)}</span>
                </div>
                <h4 className="font-bold text-gray-900">{m.name}</h4>
                <p className="text-xs text-gray-500 mt-1">Estoque: {m.stock} un</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'movimentacao' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Histórico de Caixa e Vendas (Cantina)</h3>
                <p className="text-xs text-gray-500">Mapeamento de todas as vendas do PDV e movimentações financeiras da cantina.</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
                  {records.filter(r => r.module === 'cantina').length} Registros
                </span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição / Comanda</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Categoria / Ramo</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records
                    .filter(r => r.module === 'cantina')
                    .map((r) => {
                      const isIncome = r.type === 'income';
                      return (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {r.date ? format(new Date(r.date), 'dd/MM/yyyy HH:mm') : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-gray-900 block text-sm">{r.description}</span>
                            {r.branch && <span className="text-[10px] text-gray-400 font-bold uppercase">{r.branch}</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">
                              {r.category}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1",
                              isIncome ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
                              {isIncome ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {isIncome ? 'Entrada / Venda' : 'Saída / Custo'}
                            </span>
                          </td>
                          <td className={cn(
                            "px-6 py-4 font-bold text-sm text-right",
                            isIncome ? "text-green-600" : "text-red-600"
                          )}>
                            {isIncome ? '+' : '-'} R$ {Number(r.amount).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  
                  {records.filter(r => r.module === 'cantina').length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        <History size={48} className="mx-auto mb-4 opacity-10" />
                        Nenhuma movimentação ou venda registrada na cantina ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'configuracoes' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-6">Controle de Acesso (Cantina)</h2>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="font-bold mb-2">Segregação de Funções</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Controle quem pode registrar gastos, eventos e gerenciar materiais da cantina.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <span className="text-sm font-medium">Coordenador da Cantina</span>
                    <span className="text-xs text-green-600 font-bold">Acesso Total</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <span className="text-sm font-medium">Tesoureiro</span>
                    <span className="text-xs text-blue-600 font-bold">Apenas Financeiro</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'relatorios' && (() => {
        const cantinaRecords = records.filter(r => r.module === 'cantina');
        const totalIncome = cantinaRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const totalExpense = cantinaRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const netProfit = totalIncome - totalExpense;

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Dynamic Financial Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Faturamento de Vendas</p>
                <p className="text-2xl font-black text-green-600 mt-2">R$ {totalIncome.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Total acumulado de entradas</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Custos & Retiradas</p>
                <p className="text-2xl font-black text-red-600 mt-2">R$ {totalExpense.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Total extraído de despesas</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resultado Líquido</p>
                <p className={cn("text-2xl font-black mt-2", netProfit >= 0 ? "text-blue-600" : "text-red-555")}>
                  R$ {netProfit.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Acervo final líquido</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4">Relatórios Internos</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-left">
                    <span className="text-sm">Lucratividade por Categoria</span>
                    <Download size={16} className="text-gray-400" />
                  </button>
                  <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-left">
                    <span className="text-sm">Consumo Médio por Evento</span>
                    <Download size={16} className="text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4">Relatórios para Contadora</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-left">
                    <span className="text-sm font-medium">DRE Simplificado (PDF)</span>
                    <FileText size={16} />
                  </button>
                  <button className="w-full flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-left">
                    <span className="text-sm font-medium">Livro Caixa (Excel)</span>
                    <FileText size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Production Modal */}
      {isProductionModalOpen && selectedRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
            <ChefHat className="mx-auto text-green-600 mb-4" size={48} />
            <h2 className="text-xl font-bold mb-2">Produzir: {selectedRecipe.name}</h2>
            <p className="text-sm text-gray-500 mb-6">Informe a quantidade a ser produzida.</p>
            <form onSubmit={handleProduce} className="space-y-4">
              <input 
                type="number"
                min="1"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-center text-2xl font-bold"
                value={productionQuantity}
                onChange={(e) => setProductionQuantity(parseInt(e.target.value))}
              />
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsProductionModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ingredient Modal */}
      {isIngredientModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6">Novo Ingrediente</h2>
            <form onSubmit={handleAddIngredient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required className="w-full px-4 py-2 border border-gray-200 rounded-lg" value={newIngredient.name} onChange={e => setNewIngredient({...newIngredient, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <select className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" value={newIngredient.unit} onChange={e => setNewIngredient({...newIngredient, unit: e.target.value})}>
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilo (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="l">Litro (l)</option>
                    <option value="ml">Mililitro (ml)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque</label>
                  <input 
                    required
                    type="text"
                    placeholder="Ex: 10, 2.5"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
                    value={newIngredientStockStr}
                    onChange={e => {
                      let val = e.target.value;
                      val = val.replace(/[^0-9,\.]/g, '');
                      setNewIngredientStockStr(val);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custo (R$)</label>
                  <input 
                    required
                    type="text"
                    placeholder="Ex: 1,50"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
                    value={newIngredientCostStr}
                    onChange={e => {
                      let val = e.target.value;
                      val = val.replace(/[^0-9,\.]/g, '');
                      setNewIngredientCostStr(val);
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsIngredientModalOpen(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 animate-in fade-in duration-200">
            <h2 className="text-xl font-bold mb-6">Nova Receita</h2>
            <form onSubmit={handleAddRecipe} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Receita</label>
                <input required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={newRecipe.name} onChange={e => setNewRecipe({...newRecipe, name: e.target.value})} />
              </div>

              {/* Ingredient selector section */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-800 mb-2">Ingredientes da Receita</h4>
                
                {newRecipe.ingredients.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-4 border border-gray-100 rounded-lg p-2 bg-gray-50">
                    {newRecipe.ingredients.map((item, idx) => {
                      const ingObj = ingredients.find(i => i.id === item.ingredient_id);
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-gray-200 shadow-sm">
                          <span className="font-medium text-gray-800">{ingObj?.name || 'Desconhecido'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-mono">{item.quantity} {ingObj?.unit || 'un'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setNewRecipe({
                                  ...newRecipe,
                                  ingredients: newRecipe.ingredients.filter((_, i) => i !== idx)
                                });
                              }}
                              className="text-red-500 hover:text-red-700 font-bold px-1 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-4">Nenhum ingrediente adicionado a esta receita ainda.</p>
                )}

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-150 space-y-3">
                  <span className="text-xs font-bold text-gray-700 block">Adicionar Ingrediente</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Ingrediente</label>
                      <select
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        value={recipeIngredientId}
                        onChange={(e) => setRecipeIngredientId(e.target.value)}
                      >
                        <option value="">-- Selecione --</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Qtd / Medida</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="Qtd (ex: 2.5)"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
                          value={recipeIngredientQty}
                          onChange={(e) => {
                            let val = e.target.value;
                            val = val.replace(/[^0-9,\.]/g, '');
                            setRecipeIngredientQty(val);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!recipeIngredientId) {
                              alert("Selecione um ingrediente.");
                              return;
                            }
                            const parsedQty = parseFloat(recipeIngredientQty.replace(/\./g, '').replace(',', '.')) || 0;
                            if (parsedQty <= 0) {
                              alert("Insira uma quantidade maior que zero.");
                              return;
                            }
                            // Check if already exists, then update qty or append
                            const existingIdx = newRecipe.ingredients.findIndex(x => x.ingredient_id === recipeIngredientId);
                            let updated = [...newRecipe.ingredients];
                            if (existingIdx !== -1) {
                              updated[existingIdx].quantity = parsedQty;
                            } else {
                              updated.push({ ingredient_id: recipeIngredientId, quantity: parsedQty });
                            }
                            setNewRecipe({ ...newRecipe, ingredients: updated });
                            setRecipeIngredientId('');
                            setRecipeIngredientQty('');
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2.5 rounded transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsRecipeModalOpen(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm" disabled={newRecipe.name === ''}>Salvar Receita</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ingredient Modal */}
      {isEditIngredientModalOpen && editingIngredient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 animate-in fade-in duration-200">
            <h2 className="text-xl font-bold mb-6">Editar Ingrediente</h2>
            <form onSubmit={handleUpdateIngredient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={editingIngredient.name} onChange={e => setEditingIngredient({...editingIngredient, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <select className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" value={editingIngredient.unit} onChange={e => setEditingIngredient({...editingIngredient, unit: e.target.value})}>
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilo (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="l">Litro (l)</option>
                    <option value="ml">Mililitro (ml)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
                    value={editIngredientStockStr}
                    onChange={e => {
                      let val = e.target.value;
                      val = val.replace(/[^0-9,\.]/g, '');
                      setEditIngredientStockStr(val);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custo (R$)</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
                    value={editIngredientCostStr}
                    onChange={e => {
                      let val = e.target.value;
                      val = val.replace(/[^0-9,\.]/g, '');
                      setEditIngredientCostStr(val);
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setIsEditIngredientModalOpen(false); setEditingIngredient(null); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Recipe Modal */}
      {isEditRecipeModalOpen && editingRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 animate-in fade-in duration-200">
            <h2 className="text-xl font-bold mb-6">Editar Receita</h2>
            <form onSubmit={handleUpdateRecipe} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Receita</label>
                <input required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={editingRecipe.name} onChange={e => setEditingRecipe({...editingRecipe, name: e.target.value})} />
              </div>

              {/* Ingredient selector section */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-800 mb-2">Ingredientes da Receita</h4>
                
                {editingRecipe.ingredients.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-4 border border-gray-100 rounded-lg p-2 bg-gray-50">
                    {editingRecipe.ingredients.map((item: any, idx: number) => {
                      const ingObj = ingredients.find(i => i.id === item.ingredient_id);
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-gray-200 shadow-sm">
                          <span className="font-medium text-gray-800">{ingObj?.name || 'Desconhecido'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-mono">{item.quantity} {ingObj?.unit || 'un'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRecipe({
                                  ...editingRecipe,
                                  ingredients: editingRecipe.ingredients.filter((_: any, i: number) => i !== idx)
                                });
                              }}
                              className="text-red-500 hover:text-red-700 font-bold px-1 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-4">Nenhum ingrediente adicionado a esta receita ainda.</p>
                )}

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-150 space-y-3">
                  <span className="text-xs font-bold text-gray-700 block">Adicionar Ingrediente</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Ingrediente</label>
                      <select
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        value={editRecipeIngredientId}
                        onChange={(e) => setEditRecipeIngredientId(e.target.value)}
                      >
                        <option value="">-- Selecione --</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Qtd / Medida</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="Qtd (ex: 2.5)"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
                          value={editRecipeIngredientQty}
                          onChange={(e) => {
                            let val = e.target.value;
                            val = val.replace(/[^0-9,\.]/g, '');
                            setEditRecipeIngredientQty(val);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!editRecipeIngredientId) {
                              alert("Selecione um ingrediente.");
                              return;
                            }
                            const parsedQty = parseFloat(editRecipeIngredientQty.replace(/\./g, '').replace(',', '.')) || 0;
                            if (parsedQty <= 0) {
                              alert("Insira uma quantidade maior que zero.");
                              return;
                            }
                            // Check if already exists, then update qty or append
                            const existingIdx = editingRecipe.ingredients.findIndex((x: any) => x.ingredient_id === editRecipeIngredientId);
                            let updated = [...editingRecipe.ingredients];
                            if (existingIdx !== -1) {
                              updated[existingIdx].quantity = parsedQty;
                            } else {
                              updated.push({ ingredient_id: editRecipeIngredientId, quantity: parsedQty });
                            }
                            setEditingRecipe({ ...editingRecipe, ingredients: updated });
                            setEditRecipeIngredientId('');
                            setEditRecipeIngredientQty('');
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2.5 rounded transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setIsEditRecipeModalOpen(false); setEditingRecipe(null); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6">Novo Lançamento Financeiro</h2>
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
                <button 
                  type="button"
                  onClick={() => setNewRecord({...newRecord, type: 'income'})}
                  className={cn(
                    "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                    newRecord.type === 'income' ? "bg-white text-green-600 shadow-sm" : "text-gray-500"
                  )}
                >
                  Entrada
                </button>
                <button 
                  type="button"
                  onClick={() => setNewRecord({...newRecord, type: 'expense'})}
                  className={cn(
                    "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                    newRecord.type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-gray-500"
                  )}
                >
                  Saída
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Venda de salgados, Compra de insumos..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newRecord.description}
                  onChange={(e) => setNewRecord({...newRecord, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={isNaN(newRecord.amount) ? '' : newRecord.amount}
                    onChange={(e) => setNewRecord({...newRecord, amount: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newRecord.category}
                    onChange={(e) => setNewRecord({...newRecord, category: e.target.value})}
                  >
                    <option>Venda Direta</option>
                    <option>Evento Especial</option>
                    <option>Compra de Insumos</option>
                    <option>Manutenção</option>
                    <option>Outros</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox"
                  id="extraordinary"
                  className="w-4 h-4 text-blue-600 rounded"
                  checked={newRecord.is_extraordinary}
                  onChange={(e) => setNewRecord({...newRecord, is_extraordinary: e.target.checked})}
                />
                <label htmlFor="extraordinary" className="text-sm text-gray-600">Evento Extraordinário</label>
              </div>

              {/* NF/Recibo Upload Field */}
              <div className="border-t border-gray-100 pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Anexar Nota Fiscal / Recibo</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*,application/pdf,text/*"
                    id="receipt-file-input"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 800 * 1024) {
                          alert("Para melhor desempenho, selecione um arquivo menor que 800KB.");
                          return;
                        }
                        setAttachedFileName(file.name);
                        const reader = new FileReader();
                        reader.onload = () => {
                          setAttachedFile(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="receipt-file-input"
                    className="cursor-pointer px-4 py-2 border border-dashed border-gray-300 hover:border-blue-500 rounded-lg text-xs font-medium text-gray-600 hover:text-blue-600 bg-gray-50 flex items-center justify-center gap-1 transition-all"
                  >
                    📎 {attachedFileName ? "Alterar Anexo" : "Escolher Arquivo"}
                  </label>
                  {attachedFileName && (
                    <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                      <span className="text-[11px] font-medium text-blue-800 truncate">{attachedFileName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFile(null);
                          setAttachedFileName('');
                          const fileInput = document.getElementById('receipt-file-input') as HTMLInputElement;
                          if (fileInput) fileInput.value = '';
                        }}
                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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

      {/* View Attachment Modal */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-lg font-bold text-gray-900">Anexo: Nota Fiscal / Recibo</h3>
              <button 
                onClick={() => setViewingAttachment(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 rounded-xl p-3 flex justify-center items-center border border-gray-150 min-h-[250px]">
              {viewingAttachment.startsWith('data:image/') ? (
                <img 
                  src={viewingAttachment} 
                  alt="Anexo Nota Fiscal / Recibo" 
                  className="max-w-full max-h-[55vh] object-contain rounded shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : viewingAttachment.startsWith('data:application/pdf') ? (
                <iframe 
                  src={viewingAttachment} 
                  title="PDF Anexo" 
                  className="w-full h-[55vh] rounded"
                />
              ) : (
                <div className="text-center p-6">
                  <p className="text-sm text-gray-500 mb-3">Este arquivo não pode ser visualizado diretamente no navegador.</p>
                  <a 
                    href={viewingAttachment} 
                    download="anexo_financeiro" 
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
                  >
                    Baixar Arquivo
                  </a>
                </div>
              )}
            </div>
            <div className="pt-4 flex justify-end gap-2">
              <a 
                href={viewingAttachment} 
                download="anexo_financeiro" 
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-lg transition-colors"
              >
                Baixar Anexo
              </a>
              <button 
                onClick={() => setViewingAttachment(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6">Cadastrar Novo Material/Produto</h2>
            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newMaterial.category}
                    onChange={(e) => setNewMaterial({...newMaterial, category: e.target.value})}
                  >
                    <option>Salgados</option>
                    <option>Bebidas</option>
                    <option>Doces</option>
                    <option>Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={isNaN(newMaterial.price) ? '' : newMaterial.price}
                    onChange={(e) => setNewMaterial({...newMaterial, price: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                <input 
                  required
                  type="number"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={isNaN(newMaterial.stock) ? '' : newMaterial.stock}
                  onChange={(e) => setNewMaterial({...newMaterial, stock: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsMaterialModalOpen(false)}
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
    </div>
  );
};

export default Cantina;
