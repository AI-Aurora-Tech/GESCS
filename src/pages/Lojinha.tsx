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
  X,
  Gift,
  AlertTriangle,
  Clock,
  Check,
  DollarSign,
  Snowflake,
  Eye,
  ShoppingCart,
  MessageCircle
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import Barcode from 'react-barcode';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import Logo from '../components/Logo';
import Users from './Users';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

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
  available_for_sale?: boolean;
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
  const [selectedDemand, setSelectedDemand] = useState<any | null>(null);
  const [isDemandDetailsModalOpen, setIsDemandDetailsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [stockAction, setStockAction] = useState<'entry' | 'exit'>('entry');
  const [quantity, setQuantity] = useState(1);
  const [scannedItems, setScannedItems] = useState<Record<string, number>>({});
  const [scanInput, setScanInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printQuantities, setPrintQuantities] = useState<Record<string, number>>({});
  const [reportPeriod, setReportPeriod] = useState<'all' | 'today' | 'week' | 'month'>('month');
  const [printMode, setPrintMode] = useState<'labels' | 'report'>('labels');

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

  // PagBank / PDV Checkout states
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [terminalIp, setTerminalIp] = useState(localStorage.getItem('terminal_ip') || 'localhost:1337');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'sending' | 'waiting' | 'approved' | 'failed'>('idle');
  const [paymentError, setPaymentError] = useState('');
  const [activePdvTab, setActivePdvTab] = useState<'venda' | 'fiados' | 'movimentacao' | 'historico'>('venda');
  const [posSearchTerm, setPosSearchTerm] = useState('');
  const [pagBankSales, setPagBankSales] = useState<any[]>([]);
  const [currentTransactionRef, setCurrentTransactionRef] = useState('');
  const [pdvModalAmount, setPdvModalAmount] = useState<number>(0);
  const [activePaymentMethod, setActivePaymentMethod] = useState<'credit_card' | 'debit_card' | 'pix' | 'cash'>('credit_card');

  // Doação & Fiado states
  const [saleType, setSaleType] = useState<'normal' | 'donation' | 'fiado'>('normal');
  const [donationYouthName, setDonationYouthName] = useState('');
  const [fiadoChefeName, setFiadoChefeName] = useState('');
  const [fiadoDueDate, setFiadoDueDate] = useState('');
  const [saleApprover, setSaleApprover] = useState('');
  const [specialSales, setSpecialSales] = useState<any[]>([]);
  const [stockChecks, setStockChecks] = useState<any[]>([]);
  const [finalizingConference, setFinalizingConference] = useState(false);

  // Edição de valores em massa
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkApplyPurchase, setBulkApplyPurchase] = useState(false);
  const [bulkApplySale, setBulkApplySale] = useState(true);
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState<number>(0);
  const [bulkSalePrice, setBulkSalePrice] = useState<number>(0);

  // Pedidos de doação (criados pelos chefes -> tarefa para a lojinha)
  const [donationRequests, setDonationRequests] = useState<any[]>([]);
  const [isDonationReqModalOpen, setIsDonationReqModalOpen] = useState(false);
  const [newDonationReq, setNewDonationReq] = useState({ youth_name: '', product_id: '', quantity: 1, notes: '' });

  // Aprovação de fiado via WhatsApp (números e link fixos no código)
  const [pendingFiadoApproval, setPendingFiadoApproval] = useState<any | null>(null);

  const APPROVERS = ['Édson', 'Sandra'];

  // Contatos de aprovação do fiado (formato DDI+DDD+numero, só dígitos)
  const WA_EDSON = '5511943862771';    // Chefe Édson: +55 11 94386-2771
  const WA_JULIANA = '5511999612471';  // Juliana:     +55 11 99961-2471
  // URL do app (para o link de aprovação no WhatsApp). Troque se o domínio mudar.
  const APP_URL = 'https://gescs.vercel.app';

  const resetSpecialSaleFields = () => {
    setSaleType('normal');
    setDonationYouthName('');
    setFiadoChefeName('');
    setFiadoDueDate('');
    setSaleApprover('');
  };

  const fetchPagBankSales = async () => {
    try {
      const res = await fetch('/api/pagbank/sales');
      const data = await res.json();
      if (data.success && data.sales) {
        setPagBankSales(data.sales);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico PagBank:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'pagvendas') {
      fetchPagBankSales();
    }
  }, [activeTab]);

  const addToCart = (product: Product) => {
    if ((product as any).available_for_sale === false) {
      alert('Este item está marcado como INDISPONÍVEL (sazonal/congelado) e não pode ser vendido. Descongele em Estoque para vender.');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, val: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const nQ = Math.max(1, item.quantity + val);
        return { ...item, quantity: nQ };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((acc, item) => acc + (item.product.sale_price || item.product.price || 0) * item.quantity, 0);
  };

  const completePdvSale = async (ref: string, methodStr: string) => {
    if (cart.length === 0) {
      setPaymentStatus('approved');
      return;
    }
    try {
      const itemsText = cart.map(i => `${i.quantity}x ${i.product.name}`).join(', ');
      const totalAmount = getCartTotal();
      const currentSaleType = saleType;
      const cartSnapshot = cart.map(i => ({
        name: i.product.name,
        size: i.product.size || null,
        quantity: i.quantity,
        price: i.product.sale_price || i.product.price || 0
      }));
      const txNotes =
        currentSaleType === 'donation'
          ? `Doação Ref: ${ref} — Jovem: ${donationYouthName} (Aprov.: ${saleApprover})`
          : currentSaleType === 'fiado'
          ? `Fiado Ref: ${ref} — Chefe: ${fiadoChefeName} (Aprov.: ${saleApprover}, vence ${fiadoDueDate})`
          : `Venda PDV Ref: ${ref} (${methodStr === 'cash' ? 'Dinheiro' : 'PagBank'})`;

      // 1. Decrement stock for each item in DB AND check stock for Auto-Demand
      for (const item of cart) {
        const prod = item.product;
        
        // Fetch the target product's current stock from database to be 100% safe
        const { data: dbProd } = await supabase
          .from('products')
          .select('stock, name, size')
          .eq('id', prod.id)
          .single();

        const currentDbStock = dbProd ? dbProd.stock : prod.stock;

        // Record stock transaction log (ALWAYS record sale event for dashboard, reports, and movements)
        const { error: txError } = await supabase.from('stock_transactions').insert([{
          product_id: prod.id,
          type: 'exit',
          quantity: item.quantity,
          user_id: profile?.id,
          sale_type: currentSaleType,
          notes: txNotes
        }]);
        if (txError) throw txError;

        if (currentDbStock > 0) {
          const newStock = Math.max(0, currentDbStock - item.quantity);
          
          // Update product stock
          await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', prod.id);

          // Demand trigger if stock ran dry
          if (newStock === 0) {
            try {
              const { error: demErr } = await supabase.from('lojinha_demands').insert([{
                product_id: prod.id,
                title: `Reposição Automática por Sem Estoque: ${prod.name}`,
                description: `O item ${prod.name}${prod.size ? ` (${prod.size})` : ''} acabou no estoque devido à venda PDV Ref ${ref}. Gerada demanda imediata para compra de reposição.`,
                priority: 'high',
                status: 'pending',
                user_id: profile?.id,
                user_name: 'Sistema (PDV PagBank)'
              }]);
              if (demErr) throw demErr;
            } catch (demErr: any) {
              console.warn("Could not insert product_id lojinha_demand, trying without it...", demErr);
              try {
                await supabase.from('lojinha_demands').insert([{
                  title: `Reposição Automática por Sem Estoque: ${prod.name}`,
                  description: `O item ${prod.name}${prod.size ? ` (${prod.size})` : ''} acabou no estoque devido à venda PDV Ref ${ref}. Gerada demanda imediata para compra de reposição.`,
                  priority: 'high',
                  status: 'pending',
                  user_id: profile?.id,
                  user_name: 'Sistema (PDV PagBank)'
                }]);
              } catch (fallbackDemErr) {
                console.error("Unable to insert demand as fallback too:", fallbackDemErr);
              }
            }
          }
        } else {
          // If product is already out of stock (<= 0), create a high-priority demand and do not update stock
          try {
            const { error: demErr } = await supabase.from('lojinha_demands').insert([{
              product_id: prod.id,
              title: `Produto Vendido Sem Estoque: ${prod.name}`,
              description: `Venda realizada de ${item.quantity}x ${prod.name}${prod.size ? ` (${prod.size})` : ''} com estoque esgotado. Ref: ${ref}. Gerada demanda imediata para compra urgente de reposição.`,
              priority: 'high',
              status: 'pending',
              user_id: profile?.id,
              user_name: 'Sistema (Autodemanda)'
            }]);
            if (demErr) throw demErr;
          } catch (demErr: any) {
            console.warn("Could not insert product_id lojinha_demand, trying without it...", demErr);
            try {
              await supabase.from('lojinha_demands').insert([{
                title: `Produto Vendido Sem Estoque: ${prod.name}`,
                description: `Venda realizada de ${item.quantity}x ${prod.name}${prod.size ? ` (${prod.size})` : ''} com estoque esgotado. Ref: ${ref}. Gerada demanda imediata para compra urgente de reposição.`,
                priority: 'high',
                status: 'pending',
                user_id: profile?.id,
                user_name: 'Sistema (Autodemanda)'
              }]);
            } catch (fallbackDemErr) {
              console.error("Unable to insert fallback dem:", fallbackDemErr);
            }
          }
        }
      }

      // 2. Registro financeiro / registro especial conforme o tipo de venda
      if (currentSaleType === 'normal') {
        // Venda normal: lança receita no financeiro (comportamento original)
        const fullDescription = `PDV Lojinha: ${itemsText} - Ref #${ref} (${methodStr === 'cash' ? 'Dinheiro' : 'PagBank'})`;
        const { error: finError } = await supabase.from('financial_records').insert([{
          type: 'income',
          amount: totalAmount,
          category: 'Venda Geral',
          description: fullDescription,
          module: 'lojinha',
          branch: 'Grupo',
          date: new Date().toISOString()
        }]);
        if (finError) throw finError;
      } else if (currentSaleType === 'donation') {
        // Doação: baixa no estoque SEM movimentação financeira
        const { error: donError } = await supabase.from('lojinha_special_sales').insert([{
          reference: ref,
          sale_type: 'donation',
          total_amount: totalAmount,
          items: cartSnapshot,
          youth_name: donationYouthName,
          approver: saleApprover,
          user_id: profile?.id,
          user_name: profile?.display_name,
          notes: `Doação para o jovem ${donationYouthName} — aprovada por ${saleApprover}. Itens: ${itemsText}`
        }]);
        if (donError) throw donError;
      } else if (currentSaleType === 'fiado') {
        // Fiado: fica como "a receber"; a receita só entra ao marcar como pago
        const { error: fiadoError } = await supabase.from('lojinha_special_sales').insert([{
          reference: ref,
          sale_type: 'fiado',
          total_amount: totalAmount,
          items: cartSnapshot,
          chefe_name: fiadoChefeName,
          approver: saleApprover,
          due_date: fiadoDueDate,
          paid: false,
          user_id: profile?.id,
          user_name: profile?.display_name,
          notes: `Fiado do chefe ${fiadoChefeName} — aprovado por ${saleApprover}. Itens: ${itemsText}`
        }]);
        if (fiadoError) throw fiadoError;
      }

      // Captura os dados do fiado ANTES de limpar os campos (para o alerta de aprovação)
      const fiadoInfo = currentSaleType === 'fiado' ? {
        chefe_name: fiadoChefeName,
        total_amount: totalAmount,
        due_date: fiadoDueDate,
        items: cartSnapshot
      } : null;

      setPaymentStatus('approved');
      setCart([]);
      resetSpecialSaleFields();
      fetchData();
      fetchPagBankSales();

      if (currentSaleType === 'donation') {
        alert('Doação registrada com sucesso! Os itens foram baixados do estoque, sem movimentação financeira.');
      } else if (currentSaleType === 'fiado') {
        // Abre o alerta de aprovação por WhatsApp (Édson / Juliana)
        setPendingFiadoApproval(fiadoInfo);
      }
    } catch (err: any) {
      console.error("Erro ao registrar a conclusão da venda:", err);
      setPaymentError(err.message || 'Erro ao persistir a venda.');
      setPaymentStatus('failed');
      alert('Erro ao registrar a venda: ' + (err?.message || 'Erro inesperado') + '\n\nSe a mensagem falar em permissão/policy (RLS), rode o script SQL de permissões no Supabase.');
    }
  };

  const handlePdvCheckout = async () => {
    if (cart.length === 0) return;
    const total = getCartTotal();
    const reference = `LJ-${Date.now().toString().slice(-6)}`;
    setCurrentTransactionRef(reference);
    setPaymentError('');

    // Doação: baixa estoque, sem financeiro, SEM maquininha (não abrir a telinha)
    if (saleType === 'donation') {
      if (!donationYouthName.trim()) { alert('Informe o nome do Jovem para registrar a doação.'); return; }
      if (!saleApprover) { alert('Selecione o aprovador (Édson ou Sandra).'); return; }
      await completePdvSale(reference, 'none');
      return;
    }

    // Fiado: registra "a receber", sem financeiro agora, SEM maquininha
    if (saleType === 'fiado') {
      if (!fiadoChefeName.trim()) { alert('Informe o nome do Chefe que pegou o item.'); return; }
      if (!fiadoDueDate) { alert('Informe a data de pagamento do fiado.'); return; }
      if (!saleApprover) { alert('Selecione o aprovador (Édson ou Sandra).'); return; }
      await completePdvSale(reference, 'none');
      return;
    }

    if (activePaymentMethod === 'cash') {
      setPaymentStatus('sending');
      await completePdvSale(reference, 'cash');
    } else {
      setPaymentStatus('sending');
      try {
        localStorage.setItem('terminal_ip', terminalIp);
        setPdvModalAmount(total);

        // Attempt cloud pre-request to PagBank
        try {
          await fetch('/api/pagbank/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: total,
              reference,
              items: cart.map(i => ({
                name: i.product.name,
                quantity: i.quantity,
                price: i.product.sale_price || i.product.price || 0
              })),
              module: 'lojinha',
              paymentMethod: activePaymentMethod,
              terminalIp
            })
          });
        } catch (apiError) {
          console.warn("PagBank cloud registrar failed but local checkout remains active:", apiError);
        }

        // Toggle wait status for local terminal approval or simulation fallback
        setPaymentStatus('waiting');
        
        // Non-blocking trigger local API of terminal (PlugPag local protocol)
        try {
          fetch(`http://${terminalIp}/api/v1/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify({
              amount: Math.round(total * 100),
              paymentMethod: activePaymentMethod === 'debit_card' ? 2 : 1,
              installments: 1,
              userReference: reference
            })
          }).then(async (localRes) => {
            const localResult = await localRes.json();
            if (localResult.success || localResult.status === 'APPROVED') {
              await completePdvSale(reference, 'PagBank');
            }
          }).catch(err => {
            console.warn("Direct native HTTP PlugPag connection inactive, falling back to local emulator overlay.");
          });
        } catch (localErr) {
          console.warn("Local terminal dispatch failed, displaying safe emulation helper:", localErr);
        }
      } catch (err: any) {
        console.error("Erro na comunicação PagBank:", err);
        setPaymentStatus('failed');
        setPaymentError(err.message || 'Falha ao processar checkout.');
      }
    }
  };

  const handleMarkFiadoPaid = async (sale: any) => {
    if (!window.confirm(`Confirmar o recebimento do fiado de ${sale.chefe_name} no valor de R$ ${Number(sale.total_amount || 0).toFixed(2)}?`)) return;
    try {
      // Só agora entra a receita no financeiro
      const { error: finError } = await supabase.from('financial_records').insert([{
        type: 'income',
        amount: Number(sale.total_amount || 0),
        category: 'Venda Fiado',
        description: `Pagamento de fiado — Chefe ${sale.chefe_name} (Ref #${sale.reference || sale.id})`,
        module: 'lojinha',
        branch: 'Grupo',
        date: new Date().toISOString()
      }]);
      if (finError) throw finError;

      const { error: updError } = await supabase
        .from('lojinha_special_sales')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .eq('id', sale.id);
      if (updError) throw updError;

      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao registrar o pagamento do fiado: ' + (err?.message || 'Erro inesperado'));
    }
  };

  const handleFiadoApproval = async (sale: any, decision: 'approved' | 'denied') => {
    const label = decision === 'approved' ? 'APROVAR' : 'NEGAR';
    if (!window.confirm(`${label} o fiado de ${sale.chefe_name} (R$ ${Number(sale.total_amount || 0).toFixed(2)})?`)) return;
    try {
      const { error } = await supabase
        .from('lojinha_special_sales')
        .update({
          approval_status: decision,
          approved_by: profile?.display_name || 'Responsável',
          approved_at: new Date().toISOString()
        })
        .eq('id', sale.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao registrar a decisão: ' + (err?.message || '') + '\n\nSe falar em coluna inexistente, rode o SQL (PARTE 6).');
    }
  };

  const handleFinalizeConference = async () => {
    const scannedProducts = products.filter(p => (scannedItems[p.barcode] || 0) > 0);
    if (scannedProducts.length === 0) {
      alert('Escaneie ao menos um produto antes de finalizar a conferência.');
      return;
    }

    // Só ajusta os produtos escaneados cuja contagem física difere do sistema.
    // Produtos NÃO escaneados não são zerados (evita zerar por esquecimento de leitura).
    const adjustments = scannedProducts
      .map(p => ({ p, physical: scannedItems[p.barcode] || 0 }))
      .filter(x => x.physical !== (Number(x.p.stock) || 0));

    const confirmMsg = adjustments.length === 0
      ? 'Nenhuma divergência entre a contagem física e o sistema. Deseja registrar a conferência mesmo assim?'
      : `Finalizar conferência? ${adjustments.length} produto(s) terão o estoque ajustado para a contagem física.`;
    if (!window.confirm(confirmMsg)) return;

    setFinalizingConference(true);
    try {
      for (const { p, physical } of adjustments) {
        const currentStock = Number(p.stock) || 0;
        const diff = physical - currentStock;

        // Grava a movimentação primeiro; se falhar, não altera o estoque desse item
        const { error: txErr } = await supabase.from('stock_transactions').insert([{
          product_id: p.id,
          type: diff > 0 ? 'entry' : 'exit',
          quantity: Math.abs(diff),
          user_id: profile?.id,
          notes: `Ajuste por conferência de estoque (sistema: ${currentStock} → físico: ${physical})`
        }]);
        if (txErr) throw txErr;

        const { data: updated, error: updErr } = await supabase
          .from('products')
          .update({ stock: physical })
          .eq('id', p.id)
          .select('id');
        if (updErr) throw updErr;
        if (!updated || updated.length === 0) {
          throw new Error('Não foi possível ajustar o estoque (0 linhas). Verifique as permissões (RLS) de UPDATE em "products".');
        }
      }

      await supabase.from('lojinha_stock_checks').insert([{
        user_id: profile?.id,
        user_name: profile?.display_name || 'Funcionário(a) Lojinha',
        total_items: scannedProducts.length,
        divergences: adjustments.length,
        details: adjustments.map(a => ({
          name: a.p.name,
          size: a.p.size || null,
          system: Number(a.p.stock) || 0,
          physical: a.physical
        }))
      }]);

      setScannedItems({});
      fetchData();
      alert(`Conferência finalizada! ${adjustments.length} ajuste(s) de estoque aplicado(s).`);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao finalizar a conferência: ' + (err?.message || 'Erro inesperado'));
    } finally {
      setFinalizingConference(false);
    }
  };

  // ---- Edição de valores em massa ----
  const handleBulkPriceUpdate = async () => {
    const ids = Array.from(selectedProductIds);
    if (ids.length === 0) { alert('Selecione ao menos um produto.'); return; }
    if (!bulkApplyPurchase && !bulkApplySale) { alert('Marque ao menos um valor para alterar (custo e/ou venda).'); return; }
    try {
      const patch: any = {};
      if (bulkApplyPurchase) patch.purchase_price = Number(bulkPurchasePrice) || 0;
      if (bulkApplySale) { patch.sale_price = Number(bulkSalePrice) || 0; patch.price = Number(bulkSalePrice) || 0; }

      const { data: updated, error } = await supabase
        .from('products')
        .update(patch)
        .in('id', ids)
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error('Nenhum produto foi alterado (0 linhas). Verifique as permissões (RLS) de UPDATE em "products".');
      }
      setIsBulkEditOpen(false);
      setSelectedProductIds(new Set());
      fetchData();
      alert(`${updated.length} produto(s) atualizado(s).`);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao alterar valores em massa: ' + (err?.message || 'Erro inesperado'));
    }
  };

  // ---- Disponibilidade do produto (item sazonal: congelar/descongelar) ----
  const handleToggleProductAvailability = async (product: Product) => {
    const makeUnavailable = (product as any).available_for_sale !== false; // hoje disponível -> vai congelar
    try {
      const { error } = await supabase
        .from('products')
        .update({ available_for_sale: !makeUnavailable })
        .eq('id', product.id);
      if (error) throw error;

      // Ao congelar um item sazonal, congela também as demandas pendentes dele
      if (makeUnavailable) {
        await supabase
          .from('lojinha_demands')
          .update({ frozen: true })
          .eq('product_id', product.id)
          .neq('status', 'completed');
      } else {
        await supabase
          .from('lojinha_demands')
          .update({ frozen: false })
          .eq('product_id', product.id);
      }
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao alterar disponibilidade do produto: ' + (err?.message || 'Erro inesperado') + '\n\nSe falar em coluna inexistente, rode o SQL (PARTE 4).');
    }
  };

  // ---- Demandas: ciência, confirmação de compra e congelar ----
  const handleAcknowledgeDemand = async (demand: any) => {
    try {
      const { error } = await supabase
        .from('lojinha_demands')
        .update({ acknowledged_by: profile?.display_name || 'Responsável', acknowledged_at: new Date().toISOString() })
        .eq('id', demand.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao confirmar ciência: ' + (err?.message || '') + '\n\nSe falar em coluna inexistente, rode o SQL (PARTE 4).');
    }
  };

  const handleConfirmPurchase = async (demand: any) => {
    if (!window.confirm('Confirmar a COMPRA deste item? A demanda será concluída e sairá dos alertas.')) return;
    try {
      const { error } = await supabase
        .from('lojinha_demands')
        .update({
          status: 'completed',
          purchased_by: profile?.display_name || 'Responsável',
          purchased_at: new Date().toISOString()
        })
        .eq('id', demand.id);
      if (error) throw error;
      fetchData();
      setIsDemandDetailsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao confirmar compra: ' + (err?.message || ''));
    }
  };

  const handleToggleFreezeDemand = async (demand: any) => {
    const willFreeze = !demand.frozen;
    try {
      const { error } = await supabase
        .from('lojinha_demands')
        .update({
          frozen: willFreeze,
          frozen_by: willFreeze ? (profile?.display_name || 'Responsável') : null,
          frozen_at: willFreeze ? new Date().toISOString() : null
        })
        .eq('id', demand.id);
      if (error) throw error;
      fetchData();
      setIsDemandDetailsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao congelar/descongelar a demanda: ' + (err?.message || '') + '\n\nSe falar em coluna inexistente, rode o SQL (PARTE 4).');
    }
  };

  // ---- Pedidos de doação (chefe cria -> lojinha realiza) ----
  const handleCreateDonationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDonationReq.youth_name.trim()) { alert('Informe o nome do Jovem.'); return; }
    if (!newDonationReq.product_id) { alert('Selecione o item a ser doado.'); return; }
    const prod = products.find(p => p.id === newDonationReq.product_id);
    try {
      const { error } = await supabase.from('lojinha_donation_requests').insert([{
        youth_name: newDonationReq.youth_name.trim(),
        product_id: newDonationReq.product_id,
        item_name: prod ? `${prod.name}${prod.size ? ` (${prod.size})` : ''}` : null,
        quantity: Number(newDonationReq.quantity) || 1,
        status: 'pending',
        requested_by: profile?.display_name,
        requester_id: profile?.id,
        notes: newDonationReq.notes
      }]);
      if (error) throw error;
      setIsDonationReqModalOpen(false);
      setNewDonationReq({ youth_name: '', product_id: '', quantity: 1, notes: '' });
      fetchData();
      alert('Pedido de doação criado! A equipe da lojinha verá a tarefa em Vendas → Fiados & Doações.');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao criar pedido de doação: ' + (err?.message || '') + '\n\nSe falar em tabela inexistente, rode o SQL (PARTE 4).');
    }
  };

  const handleFulfillDonationRequest = async (req: any) => {
    const prod = products.find(p => p.id === req.product_id);
    if (!prod) { alert('Produto do pedido não encontrado no estoque atual.'); return; }
    const qty = Number(req.quantity) || 1;
    if (!window.confirm(`Confirmar a doação de ${qty}x ${prod.name}${prod.size ? ` (${prod.size})` : ''} para ${req.youth_name}? O item sairá do estoque.`)) return;
    try {
      // Movimentação de estoque (doação) — grava antes de mexer no estoque
      const { error: txErr } = await supabase.from('stock_transactions').insert([{
        product_id: prod.id,
        type: 'exit',
        quantity: qty,
        user_id: profile?.id,
        sale_type: 'donation',
        notes: `Doação (pedido do chefe ${req.requested_by || '-'}) — Jovem: ${req.youth_name}`
      }]);
      if (txErr) throw txErr;

      const { data: dbProd } = await supabase.from('products').select('stock').eq('id', prod.id).single();
      const currentStock = Number(dbProd?.stock) || 0;
      await supabase.from('products').update({ stock: Math.max(0, currentStock - qty) }).eq('id', prod.id);

      // Registro da doação
      await supabase.from('lojinha_special_sales').insert([{
        reference: `DOA-${Date.now().toString().slice(-6)}`,
        sale_type: 'donation',
        total_amount: (prod.sale_price || prod.price || 0) * qty,
        items: [{ name: prod.name, size: prod.size || null, quantity: qty, price: prod.sale_price || prod.price || 0 }],
        youth_name: req.youth_name,
        approver: req.requested_by,
        user_id: profile?.id,
        user_name: profile?.display_name,
        notes: `Doação a partir de pedido do chefe ${req.requested_by || '-'}`
      }]);

      // Marca o pedido como atendido
      const { error: updErr } = await supabase.from('lojinha_donation_requests')
        .update({ status: 'fulfilled', fulfilled_by: profile?.display_name, fulfilled_at: new Date().toISOString() })
        .eq('id', req.id);
      if (updErr) throw updErr;

      fetchData();
      alert('Doação realizada e pedido concluído!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao realizar a doação: ' + (err?.message || 'Erro inesperado'));
    }
  };

  const handleCancelDonationRequest = async (req: any) => {
    if (!window.confirm('Cancelar este pedido de doação?')) return;
    try {
      const { error } = await supabase.from('lojinha_donation_requests').update({ status: 'cancelled' }).eq('id', req.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao cancelar o pedido: ' + (err?.message || ''));
    }
  };

  // ---- WhatsApp (aprovação de fiado) ----
  const buildWaLink = (phone: string, message: string) => {
    const digits = (phone || '').replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };

  const fiadoApprovalMessage = (sale: any) => {
    const itens = Array.isArray(sale?.items) ? sale.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ') : '-';
    const venc = sale?.due_date ? format(new Date(sale.due_date + 'T00:00:00'), 'dd/MM/yyyy') : '-';
    const link = `${APP_URL}/lojinha#fiados`;
    return (
      `Foi solicitada uma venda Fiado, segue os dados:\n` +
      `${sale?.chefe_name || '-'}\n` +
      `${itens}\n` +
      `${venc}\n\n` +
      `${link}\n\n` +
      `Obrigado`
    );
  };

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

    const specialSalesSubscription = supabase
      .channel('special_sales_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lojinha_special_sales' }, () => fetchData())
      .subscribe();

    const stockChecksSubscription = supabase
      .channel('stock_checks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lojinha_stock_checks' }, () => fetchData())
      .subscribe();

    const donationRequestsSubscription = supabase
      .channel('donation_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lojinha_donation_requests' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(productsSubscription);
      supabase.removeChannel(transactionsSubscription);
      supabase.removeChannel(demandsSubscription);
      supabase.removeChannel(specialSalesSubscription);
      supabase.removeChannel(stockChecksSubscription);
      supabase.removeChannel(donationRequestsSubscription);
    };
  }, [user, authLoading]);

  // Link do WhatsApp (#fiados) abre direto a aba Vendas → Fiados & Doações
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#fiados') {
      setActiveTab('pagvendas');
      setActivePdvTab('fiados');
    }
  }, []);

  const fetchData = async () => {
    const { data: prods } = await supabase.from('products').select('*').order('name');
    if (prods) setProducts(prods);

    // Mapa de nomes de usuário (evita depender de um JOIN/FK que pode falhar)
    let profilesMap: Record<string, string> = {};
    try {
      const { data: profs } = await supabase.from('profiles').select('id, display_name');
      (profs || []).forEach((p: any) => { if (p?.id) profilesMap[p.id] = p.display_name; });
    } catch (e) { /* ignora */ }
    const attachName = (rows: any[]) => (rows || []).map(r => ({
      ...r,
      profiles: r.user_id && profilesMap[r.user_id] ? { display_name: profilesMap[r.user_id] } : r.profiles
    }));

    // Movimentações: NÃO usa embed de profiles (o embed pode falhar por falta de FK
    // e retornar tudo vazio — foi o que fazia sumir vendas/entradas/saídas).
    const { data: trans, error: transErr } = await supabase
      .from('stock_transactions')
      .select('*, products(name, size, sale_price, price)')
      .order('created_at', { ascending: false });
    if (!transErr && trans) {
      setTransactions(attachName(trans));
    } else {
      if (transErr) console.warn('Falha no join products, usando consulta simples:', transErr.message);
      const { data: transPlain } = await supabase
        .from('stock_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      setTransactions(attachName(transPlain || []));
    }

    const { data: dems } = await supabase
      .from('lojinha_demands')
      .select('*')
      .order('created_at', { ascending: false });
    if (dems) setDemands(dems);

    // Special sales (doações e fiados). Tabela pode não existir ainda (rodar o SQL).
    const { data: special } = await supabase
      .from('lojinha_special_sales')
      .select('*')
      .order('created_at', { ascending: false });
    if (special) setSpecialSales(special);

    // Conferências de estoque (para o alerta de 15 dias). Tabela pode não existir ainda.
    const { data: checks } = await supabase
      .from('lojinha_stock_checks')
      .select('*')
      .order('created_at', { ascending: false });
    if (checks) setStockChecks(checks);

    // Pedidos de doação (criados pelos chefes). Tabela pode não existir ainda.
    const { data: reqs } = await supabase
      .from('lojinha_donation_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (reqs) setDonationRequests(reqs);
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
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao cadastrar produto: ${err?.message || 'Verifique se todos os campos estão corretos ou se há problemas de permissão (RLS).'}`);
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
    setTimeout(() => window.print(), 100);
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
      const priorityMap: Record<string, string> = {
        'Baixa': 'low',
        'Média': 'medium',
        'Alta': 'high'
      };
      const statusMap: Record<string, string> = {
        'Pendente': 'pending',
        'Em Progresso': 'in_progress',
        'Concluído': 'completed'
      };
      const dbPriority = priorityMap[newDemand.priority] || 'medium';
      const dbStatus = statusMap[newDemand.status] || 'pending';

      const { error } = await supabase.from('lojinha_demands').insert([{
        title: newDemand.title,
        description: newDemand.description,
        priority: dbPriority,
        status: dbStatus,
        user_id: profile?.id,
        user_name: profile?.display_name
      }]);
      if (error) throw error;

      setIsDemandModalOpen(false);
      setNewDemand({ title: '', description: '', priority: 'Média', status: 'Pendente' });
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao cadastrar a demanda: ' + (err?.message || 'Erro inesperado') + '\n\nSe falar em permissão/policy (RLS), rode o script SQL de permissões no Supabase.');
    }
  };

  const handleUpdateDemandStatus = async (demandId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('lojinha_demands')
        .update({ status: newStatus })
        .eq('id', demandId);
      if (error) throw error;
      fetchData();
      setIsDemandDetailsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao atualizar demanda: ${err?.message || 'Erro inesperado'}`);
    }
  };

  const handleDeleteDemand = async (demandId: string) => {
    if (!window.confirm("Deseja realmente excluir esta demanda?")) return;
    try {
      const { error } = await supabase
        .from('lojinha_demands')
        .delete()
        .eq('id', demandId);
      if (error) throw error;
      fetchData();
      setIsDemandDetailsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao excluir demanda: ${err?.message || 'Erro inesperado'}`);
    }
  };

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = Number(quantity) || 0;
    if (qty <= 0) { alert('Informe uma quantidade válida (maior que zero).'); return; }

    try {
      // Busca o estoque mais recente do banco para não usar um valor defasado da tela
      const { data: dbProd, error: fetchErr } = await supabase
        .from('products')
        .select('stock')
        .eq('id', selectedProduct.id)
        .single();
      if (fetchErr) throw fetchErr;

      const currentStock = Number(dbProd?.stock) || 0;
      const newStock = stockAction === 'entry' ? currentStock + qty : currentStock - qty;

      // IMPORTANTE: grava a MOVIMENTAÇÃO primeiro. Se falhar (ex.: CHECK/ RLS),
      // interrompe ANTES de alterar o estoque — evita estoque mudar sem registro.
      const { error: transError } = await supabase
        .from('stock_transactions')
        .insert([{
          product_id: selectedProduct.id,
          type: stockAction,
          quantity: qty,
          user_id: profile?.id,
          notes: `Ajuste manual de estoque (${stockAction === 'entry' ? 'entrada' : 'saída'})`
        }]);
      if (transError) throw transError;

      // Atualiza e confirma que a linha foi realmente alterada (detecta bloqueio de RLS)
      const { data: updated, error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', selectedProduct.id)
        .select('id, stock');

      if (updateError) throw updateError;
      if (!updated || updated.length === 0) {
        throw new Error('A atualização não foi aplicada (0 linhas). Verifique as permissões de banco (RLS) de UPDATE na tabela "products".');
      }

      // Demanda automática: se o estoque ficar <= mínimo, cria demanda de reposição
      // (itens sazonais/congelados não geram demanda)
      if (stockAction === 'exit' && selectedProduct.available_for_sale !== false && newStock <= (Number(selectedProduct.min_stock) || 0)) {
        const { error: demandError } = await supabase
          .from('lojinha_demands')
          .insert([{
            product_id: selectedProduct.id,
            title: `Reposição Urgente: ${selectedProduct.name}${selectedProduct.size ? ` (${selectedProduct.size})` : ''}`,
            description: `O estoque atingiu ${newStock} unidades (Mínimo: ${selectedProduct.min_stock || 0}). Necessário realizar compra para atender demanda.`,
            priority: newStock < 0 ? 'high' : 'medium',
            status: 'pending',
            user_id: profile?.id,
            user_name: 'Sistema (Automático)'
          }]);

        if (demandError) console.error('Erro ao criar demanda automática:', demandError);
      }

      setIsStockModalOpen(false);
      setQuantity(1);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao atualizar o estoque: ' + (err?.message || 'Erro inesperado'));
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
    { id: 'pagvendas', label: 'Vendas', icon: CreditCard },
    { id: 'relatorios', label: 'Relatórios', icon: FileText },
    { id: 'demandas', label: 'Demandas', icon: ShoppingBag },
    { id: 'configuracoes', label: 'Acesso', icon: Settings },
  ];

  const tabs = isUserLojinha 
    ? allTabs.filter(t => !['cadastros', 'relatorios', 'configuracoes'].includes(t.id))
    : allTabs;

  const todayStr = new Date().toISOString().split('T')[0];
  const fiadoSales = specialSales.filter(s => s.sale_type === 'fiado');
  const donationSales = specialSales.filter(s => s.sale_type === 'donation');
  const overdueFiados = fiadoSales.filter(s => !s.paid && s.due_date && s.due_date < todayStr);
  const openFiadosTotal = fiadoSales
    .filter(s => !s.paid)
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const pendingDonationRequests = donationRequests.filter(r => r.status === 'pending');

  // Conferência de estoque: obrigatória a cada 15 dias
  const lastStockCheck = stockChecks[0];
  const daysSinceCheck = lastStockCheck?.created_at
    ? Math.floor((Date.now() - new Date(lastStockCheck.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const showStockCheckAlert = daysSinceCheck === null || daysSinceCheck >= 15;

  return (
    <>
      {printMode === 'labels' && (
        <div className="hidden print:block p-4">
          <div className="flex flex-wrap gap-4 justify-start">
            {products.filter(p => selectedProductIds.has(p.id)).flatMap(product => {
              const qty = printQuantities[product.id] || 1;
              return Array.from({ length: qty }).map((_, idx) => (
                <div key={`${product.id}-${idx}`} className="flex flex-col items-center p-3 border border-gray-300 rounded-lg bg-white text-black shadow-sm break-inside-avoid w-44">
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
      )}

      {printMode === 'report' && (() => {
        const filteredTrans = transactions.filter(t => {
          if (!t.created_at) return false;
          const tDate = new Date(t.created_at);
          const now = new Date();
          if (reportPeriod === 'today') {
            return tDate.toDateString() === now.toDateString();
          }
          if (reportPeriod === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return tDate >= oneWeekAgo;
          }
          if (reportPeriod === 'month') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return tDate >= oneMonthAgo;
          }
          return true; // all
        });

        const lastTrans = filteredTrans.filter(t => t.type === 'exit' && t.sale_type !== 'donation');
        const totalRevenue = lastTrans.reduce((acc, t) => {
          const price = Number(t.products?.sale_price) || Number(t.products?.price) || 0;
          return acc + (Number(t.quantity) * price);
        }, 0);

        const qtySold = lastTrans.reduce((acc, t) => acc + Number(t.quantity), 0);
        const lowStockItems = products.filter(p => Number(p.stock) <= (Number(p.min_stock) || 5));
        const totalInventoryValue = products.reduce((acc, p) => acc + (Number(p.stock) * (Number(p.purchase_price) || 0)), 0);
        const totalInventorySaleValue = products.reduce((acc, p) => acc + (Number(p.stock) * (Number(p.sale_price) || Number(p.price) || 0)), 0);

        return (
          <div className="hidden print:block p-10 font-sans bg-white text-black min-h-screen">
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-6 mb-8">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">GESCS Management - Lojinha</h1>
                <p className="text-sm font-semibold text-slate-600">Relatório Consolidado de Vendas, Financeiro e Estoque</p>
                <p className="text-xs text-slate-500 mt-1">Período Selecionado: {
                  reportPeriod === 'today' ? 'Hoje' :
                  reportPeriod === 'week' ? 'Últimos 7 dias' :
                  reportPeriod === 'month' ? 'Últimos 30 dias' : 'Todo o período'
                }</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-slate-400">Gerado em</p>
                <p className="text-sm font-bold">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            {/* Resume Metrics */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="border border-slate-200 p-4 rounded-lg">
                <p className="text-[10px] font-black uppercase text-slate-500">Total Faturado</p>
                <p className="text-xl font-bold mt-1">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="border border-slate-200 p-4 rounded-lg">
                <p className="text-[10px] font-black uppercase text-slate-500">Unidades Vendidas</p>
                <p className="text-xl font-bold mt-1">{qtySold} un</p>
              </div>
              <div className="border border-slate-200 p-4 rounded-lg">
                <p className="text-[10px] font-black uppercase text-slate-500">Custo Total de Estoque</p>
                <p className="text-xl font-bold mt-1">R$ {totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="border border-slate-200 p-4 rounded-lg">
                <p className="text-[10px] font-black uppercase text-slate-500">Valor de Venda Potencial</p>
                <p className="text-xl font-bold mt-1">R$ {totalInventorySaleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Stock Warning List */}
            <div className="space-y-4 mb-8">
              <h3 className="text-sm font-black uppercase border-b border-slate-200 pb-2">Status do Estoque (Produtos Críticos)</h3>
              {lowStockItems.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum produto em nível crítico de estoque.</p>
              ) : (
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 border-b">Produto</th>
                      <th className="p-2 border-b">Tamanho</th>
                      <th className="p-2 border-b">Categoria</th>
                      <th className="p-2 border-b text-center">Mínimo</th>
                      <th className="p-2 border-b text-center">Atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2 border-b font-medium">{p.name}</td>
                        <td className="p-2 border-b">{p.size || 'N/A'}</td>
                        <td className="p-2 border-b">{p.category}</td>
                        <td className="p-2 border-b text-center text-slate-500">{p.min_stock || 5}</td>
                        <td className="p-2 border-b text-center font-bold text-red-600 bg-red-50/50">{p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Latest Transactions */}
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase border-b border-slate-200 pb-2">Histórico de Transações do Período</h3>
              {filteredTrans.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma transação registrada neste período.</p>
              ) : (
                <table className="w-full text-left text-[11px] border border-slate-200 rounded-lg">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 border-b">Data</th>
                      <th className="p-2 border-b">Produto</th>
                      <th className="p-2 border-b text-center">Operação</th>
                      <th className="p-2 border-b text-center">Qtd</th>
                      <th className="p-2 border-b text-right">Valor Unitário</th>
                      <th className="p-2 border-b text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrans.map(t => {
                      const unitPrice = Number(t.products?.sale_price) || Number(t.products?.price) || 0;
                      const totalVal = unitPrice * t.quantity;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="p-2 border-b text-slate-500">{t.created_at ? format(new Date(t.created_at), 'dd/MM/yyyy HH:mm') : '-'}</td>
                          <td className="p-2 border-b font-medium">{t.products?.name}{t.products?.size ? ` (${t.products.size})` : ''}</td>
                          <td className="p-2 border-b text-center uppercase font-bold text-[10px]">
                            <span className={t.type === 'entry' ? "text-green-600 bg-green-50 px-1.5 py-0.5 rounded" : "text-red-600 bg-red-50 px-1.5 py-0.5 rounded"}>
                              {t.type === 'entry' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className="p-2 border-b text-center font-bold">{t.quantity}</td>
                          <td className="p-2 border-b text-right">R$ {unitPrice.toFixed(2)}</td>
                          <td className="p-2 border-b text-right font-semibold">
                            {t.type === 'exit' ? `R$ ${totalVal.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="mt-12 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-6">
              <p>GESCS Management • Sistema Homologado do Grupo Escoteiro</p>
            </div>
          </div>
        );
      })()}

      <div className="space-y-6 print:hidden">
        {overdueFiados.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center gap-3 text-red-800">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold">Fiados vencidos ({overdueFiados.length})</h3>
              <p className="text-sm text-red-600">
                Há pagamentos de fiado em atraso: {overdueFiados
                  .map(f => `${f.chefe_name} (venc. ${f.due_date ? format(new Date(f.due_date + 'T00:00:00'), 'dd/MM/yyyy') : '-'})`)
                  .join(', ')}.
              </p>
            </div>
            <button
              onClick={() => { setActiveTab('pagvendas'); setActivePdvTab('fiados'); }}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 whitespace-nowrap self-start md:self-auto"
            >
              Ver fiados
            </button>
          </div>
        )}

        {showStockCheckAlert && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center gap-3 text-blue-800">
            <BarcodeIcon className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold">Conferência de estoque pendente</h3>
              <p className="text-sm text-blue-600">
                {daysSinceCheck === null
                  ? 'Nenhuma conferência registrada ainda. A conferência do estoque deve ser feita a cada 15 dias.'
                  : `A última conferência foi há ${daysSinceCheck} dias. É necessário realizar a conferência do estoque (a cada 15 dias).`}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('conferencia')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 whitespace-nowrap self-start md:self-auto"
            >
              Fazer conferência
            </button>
          </div>
        )}

        <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">1. Sistema de Lojinha</h1>
          <p className="text-gray-500">Gestão completa de estoque e vendas.</p>
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

      {activeTab === 'estoque' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
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
              className="flex items-center justify-center px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              <BarcodeIcon size={18} className="mr-2" />
              Imprimir Etiquetas {selectedProductIds.size > 0 && `(${selectedProductIds.size})`}
            </button>
            <button
              onClick={() => {
                if (selectedProductIds.size === 0) {
                  alert('Selecione ao menos um produto (marque as caixinhas) para editar os valores em massa.');
                  return;
                }
                const first = products.find(p => selectedProductIds.has(p.id));
                setBulkPurchasePrice(Number(first?.purchase_price) || 0);
                setBulkSalePrice(Number(first?.sale_price) || Number(first?.price) || 0);
                setBulkApplyPurchase(false);
                setBulkApplySale(true);
                setIsBulkEditOpen(true);
              }}
              className="flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              <DollarSign size={18} className="mr-2" />
              Editar valores {selectedProductIds.size > 0 && `(${selectedProductIds.size})`}
            </button>
          </div>

          {/* Product Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
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
                      <p className="font-medium text-gray-900">
                        {product.name}{product.size ? ` (${product.size})` : ''}
                        {product.available_for_sale === false && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-100 text-cyan-700 align-middle">Indisponível (sazonal)</span>
                        )}
                      </p>
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
                        <button
                          onClick={() => handleToggleProductAvailability(product)}
                          className={cn(
                            "p-2 rounded-lg",
                            product.available_for_sale === false ? "text-cyan-600 bg-cyan-50 hover:bg-cyan-100" : "text-gray-400 hover:bg-cyan-50 hover:text-cyan-600"
                          )}
                          title={product.available_for_sale === false ? "Descongelar (voltar a vender)" : "Congelar (item sazonal / indisponível)"}
                        >
                          <Snowflake size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            
            <form onSubmit={handleScan} className="flex flex-col md:flex-row gap-4 mb-8">
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
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
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
          </div>
            
            {(() => {
              const scannedProds = products.filter(p => (scannedItems[p.barcode] || 0) > 0);
              const divergent = scannedProds.filter(p => (scannedItems[p.barcode] || 0) !== (Number(p.stock) || 0));
              const missing = scannedProds.filter(p => (scannedItems[p.barcode] || 0) < (Number(p.stock) || 0));
              const excess = scannedProds.filter(p => (scannedItems[p.barcode] || 0) > (Number(p.stock) || 0));
              return (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <p className="text-[10px] font-black uppercase text-gray-400">Produtos conferidos</p>
                      <p className="text-xl font-black text-gray-900">{scannedProds.length}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-100 bg-amber-50/40">
                      <p className="text-[10px] font-black uppercase text-amber-500">Divergentes</p>
                      <p className="text-xl font-black text-amber-700">{divergent.length}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-100 bg-red-50/40">
                      <p className="text-[10px] font-black uppercase text-red-500">Faltando</p>
                      <p className="text-xl font-black text-red-700">{missing.length}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-100 bg-green-50/40">
                      <p className="text-[10px] font-black uppercase text-green-600">Sobrando</p>
                      <p className="text-xl font-black text-green-700">{excess.length}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <p className="text-xs text-gray-400 self-center max-w-md">
                      Produtos não escaneados ficam como "Pendente" e <strong>não são alterados</strong> ao finalizar. Ao finalizar, os produtos conferidos têm o estoque ajustado para a contagem física.
                    </p>
                    <div className="flex gap-2 justify-end flex-shrink-0">
                      <button
                        onClick={() => setScannedItems({})}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                      >
                        Zerar Contagem
                      </button>
                      <button
                        onClick={handleFinalizeConference}
                        disabled={finalizingConference || scannedProds.length === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      >
                        <Check size={16} /> {finalizingConference ? 'Finalizando...' : 'Finalizar e Corrigir Estoque'}
                      </button>
                    </div>
                  </div>
                  {lastStockCheck?.created_at && (
                    <p className="text-[11px] text-gray-400">
                      Última conferência: {format(new Date(lastStockCheck.created_at), 'dd/MM/yyyy HH:mm')}
                      {lastStockCheck.user_name ? ` por ${lastStockCheck.user_name}` : ''}.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === 'cadastros' && (
        <div className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-6">Ingestão de Dados Cadastrais</h2>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Sub Tab Selection */}
          <div className="flex bg-gray-100 p-1 rounded-lg self-start max-w-2xl">
            <button
              onClick={() => setActivePdvTab('venda')}
              className={cn(
                "flex-1 px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2",
                activePdvTab === 'venda' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
              )}
            >
              <ShoppingBag size={14} /> Registrar Venda (PDV)
            </button>
            <button
              onClick={() => setActivePdvTab('fiados')}
              className={cn(
                "flex-1 px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 relative",
                activePdvTab === 'fiados' ? "bg-white text-amber-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
              )}
            >
              <Clock size={14} /> Fiados &amp; Doações
              {overdueFiados.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                  {overdueFiados.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActivePdvTab('movimentacao')}
              className={cn(
                "flex-1 px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2",
                activePdvTab === 'movimentacao' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
              )}
            >
              <History size={14} /> Movimentações
            </button>
            <button
              onClick={() => {
                setActivePdvTab('historico');
                fetchPagBankSales();
              }}
              className={cn(
                "flex-1 px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2",
                activePdvTab === 'historico' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
              )}
            >
              <History size={14} /> Maquininha
            </button>
          </div>

          {activePdvTab === 'venda' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Product Shelf / Search (Left) */}
              <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
                <div className="mb-4">
                  <h3 className="text-lg font-bold mb-1">Pesquisar Produtos</h3>
                  <p className="text-xs text-gray-500">Adicione itens ao carrinho clicando nos cards abaixo.</p>
                  
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Pesquisar por nome ou código de barras..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={posSearchTerm}
                      onChange={(e) => setPosSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {products
                    .filter(p => p.name.toLowerCase().includes(posSearchTerm.toLowerCase()) || (p.barcode && p.barcode.includes(posSearchTerm)))
                    .map(product => {
                      const inStock = product.stock > 0;
                      const unavailable = product.available_for_sale === false;
                      return (
                        <div
                          key={product.id}
                          onClick={() => addToCart(product)}
                          className={cn(
                            "flex items-center justify-between p-3 border rounded-xl transition-all",
                            unavailable ? "border-cyan-100 bg-cyan-50/30 opacity-70 cursor-not-allowed"
                              : "cursor-pointer hover:border-blue-400 " + (inStock ? "border-gray-100 bg-gray-50/50" : "border-red-100 bg-red-50/20")
                          )}
                        >
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {product.name}{product.size ? ` (${product.size})` : ''}
                              {unavailable && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-cyan-100 text-cyan-700">Indisponível</span>}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-gray-400 font-mono">Barras: {product.barcode || 'N/A'}</span>
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                inStock ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              )}>
                                Estoque: {product.stock} un
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-gray-900">R$ {(product.sale_price || product.price || 0).toFixed(2)}</p>
                            <span className="text-[10px] text-gray-400 font-medium">{product.category}</span>
                          </div>
                        </div>
                      );
                    })}
                  
                  {products.length === 0 && (
                    <div className="text-center py-12 text-gray-400">Nenhum produto cadastrado no estoque.</div>
                  )}
                </div>
              </div>

              {/* Shopping Cart & Checkout (Right) */}
              <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
                <div className="border-b border-gray-100 pb-4 mb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold">Carrinho de Compras</h3>
                    <p className="text-xs text-gray-500">Itens selecionados para a venda.</p>
                  </div>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs font-bold text-red-500 hover:text-red-700"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Items list */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50/30">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-xs font-bold text-gray-900 truncate">{item.product.name}{item.product.size ? ` (${item.product.size})` : ''}</p>
                        <p className="text-xs text-gray-500">R$ {((item.product.sale_price || item.product.price || 0) * item.quantity).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, -1)}
                          className="p-1 border border-gray-200 rounded bg-white hover:bg-gray-50"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => addToCart(item.product)}
                          className="p-1 border border-gray-200 rounded bg-white hover:bg-gray-50"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded ml-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                      <ShoppingBag size={40} className="mb-2 opacity-20" />
                      <p className="text-sm">O carrinho está vazio</p>
                    </div>
                  )}
                </div>

                {/* Settings IP & Payment Methods */}
                {cart.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-sm font-bold text-gray-700">Total Geral:</span>
                      <span className="text-xl font-black text-gray-900">R$ {getCartTotal().toFixed(2)}</span>
                    </div>

                    {/* Tipo de Venda: Normal / Doação / Fiado */}
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400 block mb-2">Tipo de Venda</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'normal', label: 'Venda', icon: ShoppingBag, active: 'border-blue-500 bg-blue-50 text-blue-600' },
                          { id: 'donation', label: 'Doação', icon: Gift, active: 'border-emerald-500 bg-emerald-50 text-emerald-600' },
                          { id: 'fiado', label: 'Fiado', icon: Clock, active: 'border-amber-500 bg-amber-50 text-amber-600' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSaleType(opt.id as any)}
                            className={cn(
                              "p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1",
                              saleType === opt.id ? `${opt.active} font-bold` : "border-gray-200 hover:border-gray-300 text-gray-500"
                            )}
                          >
                            <opt.icon size={16} />
                            <span className="text-[11px]">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Campos de Doação */}
                    {saleType === 'donation' && (
                      <div className="bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl space-y-3">
                        <p className="text-[11px] text-emerald-700 font-medium">
                          A doação baixa o item do estoque <strong>sem movimentação financeira</strong>.
                        </p>
                        <div>
                          <label className="text-[10px] font-black uppercase text-emerald-700 block mb-1">Nome do Jovem</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm"
                            placeholder="Nome do jovem beneficiado"
                            value={donationYouthName}
                            onChange={(e) => setDonationYouthName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-emerald-700 block mb-1">Aprovado por</label>
                          <select
                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm"
                            value={saleApprover}
                            onChange={(e) => setSaleApprover(e.target.value)}
                          >
                            <option value="">Selecione o aprovador...</option>
                            {APPROVERS.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Campos de Fiado */}
                    {saleType === 'fiado' && (
                      <div className="bg-amber-50/40 border border-amber-100 p-3 rounded-xl space-y-3">
                        <p className="text-[11px] text-amber-700 font-medium">
                          O fiado fica como <strong>a receber</strong>. A receita só entra no financeiro ao marcar como pago.
                        </p>
                        <div>
                          <label className="text-[10px] font-black uppercase text-amber-700 block mb-1">Nome do Chefe</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm"
                            placeholder="Chefe que pegou o item"
                            value={fiadoChefeName}
                            onChange={(e) => setFiadoChefeName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-amber-700 block mb-1">Data de Pagamento</label>
                          <input
                            type="date"
                            className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm"
                            value={fiadoDueDate}
                            onChange={(e) => setFiadoDueDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-amber-700 block mb-1">Aprovado por</label>
                          <select
                            className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm"
                            value={saleApprover}
                            onChange={(e) => setSaleApprover(e.target.value)}
                          >
                            <option value="">Selecione o aprovador...</option>
                            {APPROVERS.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Maquininha + Forma de Pagamento (apenas venda normal) */}
                    {saleType === 'normal' && (
                      <>
                        <div className="bg-blue-50/30 border border-blue-100 p-3 rounded-xl space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase text-blue-700">IP da Moderninha Smart 2</label>
                            <span className="text-[9px] text-gray-400 font-mono">PlugPag Port: 1337</span>
                          </div>
                          <input
                            type="text"
                            className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs"
                            placeholder="Ex: localhost:1337 ou 192.168.1.150:1337"
                            value={terminalIp}
                            onChange={(e) => setTerminalIp(e.target.value)}
                          />
                        </div>

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
                                onClick={() => setActivePaymentMethod(method.id as any)}
                                className={cn(
                                  "p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center",
                                  activePaymentMethod === method.id
                                    ? "border-blue-500 bg-blue-50 text-blue-600 font-bold"
                                    : "border-gray-200 hover:border-gray-300 text-gray-500"
                                )}
                              >
                                <span className="text-xs">{method.label}</span>
                                <span className="text-[8px] opacity-75">{method.sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Checkout CTA */}
                    <button
                      onClick={handlePdvCheckout}
                      className={cn(
                        "w-full py-3 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2",
                        saleType === 'donation' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" :
                        saleType === 'fiado' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" :
                        "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                      )}
                    >
                      {saleType === 'donation' ? (
                        <><Gift size={18} /> Registrar Doação</>
                      ) : saleType === 'fiado' ? (
                        <><Clock size={18} /> Registrar Fiado (R$ {getCartTotal().toFixed(2)})</>
                      ) : (
                        <><CreditCard size={18} /> Confirmar Venda (R$ {getCartTotal().toFixed(2)})</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activePdvTab === 'fiados' && (
            <div className="space-y-6">
              {/* Pedidos de Doação (chefes criam -> lojinha realiza) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><Gift size={18} className="text-emerald-500" /> Pedidos de Doação</h3>
                    <p className="text-xs text-gray-500">Chefes (Édson/Sandra) criam o pedido; a equipe da lojinha realiza a doação.</p>
                  </div>
                  <button
                    onClick={() => setIsDonationReqModalOpen(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 self-start"
                  >
                    <Plus size={16} /> Novo pedido
                  </button>
                </div>
                {pendingDonationRequests.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">Nenhum pedido de doação pendente.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pendingDonationRequests.map((req) => (
                      <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{req.quantity}x {req.item_name || 'Item'} → {req.youth_name}</p>
                          <p className="text-[11px] text-gray-400">
                            Pedido por {req.requested_by || '-'}{req.created_at ? ` em ${format(new Date(req.created_at), 'dd/MM/yyyy')}` : ''}
                            {req.notes ? ` • ${req.notes}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-2 self-start sm:self-auto">
                          <button
                            onClick={() => handleFulfillDonationRequest(req)}
                            className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5"
                          >
                            <Check size={13} /> Realizar doação
                          </button>
                          <button
                            onClick={() => handleCancelDonationRequest(req)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-[11px] font-bold"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-[10px] font-black text-amber-500 uppercase">Fiados em aberto</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">
                    R$ {openFiadosTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">{fiadoSales.filter(s => !s.paid).length} pendente(s)</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 bg-red-50/20">
                  <p className="text-[10px] font-black text-red-500 uppercase">Fiados vencidos</p>
                  <p className="text-2xl font-black text-red-700 mt-1">{overdueFiados.length}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Pagamento em atraso</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 bg-emerald-50/20">
                  <p className="text-[10px] font-black text-emerald-600 uppercase">Doações</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{donationSales.length}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Itens doados (sem financeiro)</p>
                </div>
              </div>

              {/* Fiados */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold flex items-center gap-2"><Clock size={18} className="text-amber-500" /> Fiados</h3>
                  <p className="text-xs text-gray-500">Produtos retirados por chefes para pagamento futuro.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[820px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Chefe</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Aprovador</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fiadoSales.map((sale) => {
                        const isOverdue = !sale.paid && sale.due_date && sale.due_date < todayStr;
                        return (
                          <tr key={sale.id} className={cn("hover:bg-gray-50", isOverdue && "bg-red-50/40")}>
                            <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                              {sale.created_at ? format(new Date(sale.created_at), 'dd/MM/yyyy') : '-'}
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-gray-900">{sale.chefe_name || '-'}</p>
                              <p className="text-[11px] text-gray-400">Ref #{sale.reference || '-'}</p>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-600">{sale.approver || '-'}</td>
                            <td className={cn("px-6 py-4 text-xs font-semibold", isOverdue ? "text-red-600" : "text-gray-600")}>
                              {sale.due_date ? format(new Date(sale.due_date + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-black text-gray-900">
                              R$ {Number(sale.total_amount || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {/* Status de pagamento */}
                                {sale.paid ? (
                                  <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">Pago</span>
                                ) : isOverdue ? (
                                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase">Vencido</span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase">Em aberto</span>
                                )}
                                {/* Status de aprovação */}
                                {(sale.approval_status || 'pending') === 'approved' ? (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black uppercase">
                                    Aprovado{sale.approved_by ? `: ${sale.approved_by}` : ''}
                                  </span>
                                ) : (sale.approval_status === 'denied') ? (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-black uppercase">
                                    Negado{sale.approved_by ? `: ${sale.approved_by}` : ''}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[9px] font-black uppercase">Aprovação pendente</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                {(sale.approval_status || 'pending') === 'pending' && (
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => handleFiadoApproval(sale, 'approved')}
                                      className="px-2.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                                    >
                                      <Check size={12} /> Aprovar
                                    </button>
                                    <button
                                      onClick={() => handleFiadoApproval(sale, 'denied')}
                                      className="px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                                    >
                                      <X size={12} /> Negar
                                    </button>
                                  </div>
                                )}
                              {!sale.paid && (
                                <button
                                  onClick={() => handleMarkFiadoPaid(sale)}
                                  className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5"
                                >
                                  <Check size={13} /> Marcar como pago
                                </button>
                              )}
                              {sale.paid && sale.paid_at && (
                                <span className="text-[11px] text-gray-400">
                                  em {format(new Date(sale.paid_at), 'dd/MM/yyyy')}
                                </span>
                              )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {fiadoSales.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                            Nenhum fiado registrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Doações */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold flex items-center gap-2"><Gift size={18} className="text-emerald-500" /> Doações</h3>
                  <p className="text-xs text-gray-500">Itens doados a jovens. Baixam do estoque sem movimentação financeira.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[720px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Jovem</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Aprovador</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Itens</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor de referência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {donationSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                            {sale.created_at ? format(new Date(sale.created_at), 'dd/MM/yyyy') : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{sale.youth_name || '-'}</td>
                          <td className="px-6 py-4 text-xs text-gray-600">{sale.approver || '-'}</td>
                          <td className="px-6 py-4 text-xs text-gray-600">
                            {Array.isArray(sale.items)
                              ? sale.items.map((i: any) => `${i.quantity}x ${i.name}${i.size ? ` (${i.size})` : ''}`).join(', ')
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-gray-400">
                            R$ {Number(sale.total_amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {donationSales.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                            Nenhuma doação registrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePdvTab === 'historico' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">Maquininha (PagBank) — em breve</h3>
                  <p className="text-xs text-gray-500">A integração de vendas direto na maquininha será feita no futuro. Por enquanto, esta aba é apenas informativa.</p>
                </div>
                <button
                  onClick={fetchPagBankSales}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-gray-700 flex items-center gap-1.5"
                >
                  <History size={12} /> Sincronizar PagBank
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição / Árvore de Área</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Dispositivo</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagBankSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {format(new Date(sale.date), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900">{sale.description}</p>
                          <span className={cn(
                            "inline-block text-[9px] font-black uppercase tracking-wider rounded px-1.5 py-0.5 mt-1",
                            sale.module === 'cantina' ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
                          )}>
                            {sale.module === 'cantina' ? 'Módulo Cantina' : 'Módulo Lojinha'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-gray-600">
                          {sale.terminal}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">
                            {sale.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-black text-gray-900">
                          R$ {sale.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}

                    {pagBankSales.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                          Nenhuma venda associada ao PagBank encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment Terminal Emulator / Modal Overlay */}
          {saleType === 'normal' && paymentStatus !== 'idle' && paymentStatus !== 'approved' && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 max-w-sm w-full text-center relative overflow-hidden">
                {/* Simulated Moderninha Terminal Display */}
                <div className="w-56 h-72 bg-neutral-900 border-4 border-neutral-700 rounded-[2.5rem] p-4 mx-auto shadow-2xl relative flex flex-col justify-between overflow-hidden">
                  {/* Speaker Grill */}
                  <div className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mb-2" />
                  
                  {/* High Contrast Color POS Screen */}
                  <div className="flex-1 bg-gradient-to-b from-blue-900 to-indigo-950 rounded-2xl p-4 text-white flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center text-[8px] opacity-75 mb-2 border-b border-white/10 pb-1">
                        <span>PAGBANK POS</span>
                        <span>📶 4G</span>
                      </div>
                      <p className="text-[10px] font-bold text-center opacity-90 uppercase">Cobrança Escoteira</p>
                      <p className="text-xs opacity-75 text-center mt-1">Ref: {currentTransactionRef}</p>
                    </div>

                    <div className="text-center my-3">
                      <p className="text-xs text-cyan-300 font-black uppercase">
                        {paymentStatus === 'sending' ? 'Processando...' : 'Aprovação manual'}
                      </p>
                      <p className="text-lg font-black mt-1">R$ {(pdvModalAmount || getCartTotal()).toFixed(2)}</p>
                    </div>

                    <div className="text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-yellow-400 text-black animate-pulse">
                        Sua Moderninha
                      </span>
                    </div>
                  </div>

                  {/* Machine Keyboard Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2 border-t border-neutral-800">
                    <div className="w-full h-2.5 bg-neutral-800 rounded-sm" />
                    <div className="w-full h-2.5 bg-neutral-800 rounded-sm" />
                    <div className="w-full h-2.5 bg-neutral-800 rounded-sm" />
                  </div>
                </div>

                {/* Local Network Info */}
                <div className="mt-6">
                  <h4 className="font-bold text-gray-900">Processando Pagamento</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Enviamos um sinal na rede local via PlugPag para a máquina no endereço <strong>{terminalIp}</strong>.
                  </p>
                </div>

                {/* Simulated Approval Buttons Overlay */}
                <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Simulador Moderninha Smart 2</p>
                  <p className="text-xs text-gray-600">
                    Como a maquina real precisa de rede fisica local, você pode clicar abaixo para simular a resposta imediata:
                  </p>
                  <div className="flex gap-2.5 pt-1.5">
                    <button
                      onClick={() => setPaymentStatus('idle')}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-gray-600"
                    >
                      Recusar
                    </button>
                    <button
                      onClick={async () => {
                        await completePdvSale(currentTransactionRef, 'PagBank');
                      }}
                      className="flex-1 py-2 bg-green-500 hover:bg-green-600 rounded-xl text-xs font-black text-white shadow-lg shadow-green-200"
                    >
                      Aprovar Venda
                    </button>
                  </div>
                </div>

                {paymentError && (
                  <p className="text-xs font-bold text-red-500 mt-3">{paymentError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pagvendas' && activePdvTab === 'movimentacao' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">Movimentações — Entradas, Saídas e Vendas</h3>
              <p className="text-xs text-gray-500">Todas as vendas, entradas e saídas de estoque da lojinha.</p>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Produto</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Qtd</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Observação / Detalhe</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => {
                  const isEntry = t.type === 'entry' || t.type === 'in';
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
                          isEntry ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                        )}>
                          {isEntry ? 'Entrada' : 'Saída'}
                        </span>
                        {t.sale_type === 'donation' && (
                          <span className="ml-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-600">Doação</span>
                        )}
                        {t.sale_type === 'fiado' && (
                          <span className="ml-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-600">Fiado</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold">
                        {t.quantity}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 font-medium">
                        {t.notes || t.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {t.profiles?.display_name || t.userName || 'Sistema'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'relatorios' && (() => {
        const filteredTrans = transactions.filter(t => {
          if (!t.created_at) return false;
          const tDate = new Date(t.created_at);
          const now = new Date();
          if (reportPeriod === 'today') {
            return tDate.toDateString() === now.toDateString();
          }
          if (reportPeriod === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return tDate >= oneWeekAgo;
          }
          if (reportPeriod === 'month') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return tDate >= oneMonthAgo;
          }
          return true; // all
        });

        const lastTrans = filteredTrans.filter(t => t.type === 'exit' && t.sale_type !== 'donation');
        const totalRevenue = lastTrans.reduce((acc, t) => {
          const price = Number(t.products?.sale_price) || Number(t.products?.price) || 0;
          return acc + (Number(t.quantity) * price);
        }, 0);

        const qtySold = lastTrans.reduce((acc, t) => acc + Number(t.quantity), 0);
        const lowStockItems = products.filter(p => Number(p.stock) <= (Number(p.min_stock) || 5));
        const totalInventoryValue = products.reduce((acc, p) => acc + (Number(p.stock) * (Number(p.purchase_price) || 0)), 0);

        // Grouping sales by date for Recharts
        const groupedSalesDate: { [key: string]: number } = {};
        lastTrans.forEach(t => {
          const dStr = format(new Date(t.created_at), 'dd/MM');
          const price = Number(t.products?.sale_price) || Number(t.products?.price) || 0;
          groupedSalesDate[dStr] = (groupedSalesDate[dStr] || 0) + (Number(t.quantity) * price);
        });
        const chartData = Object.keys(groupedSalesDate).map(k => ({
          date: k,
          valor: Number(groupedSalesDate[k].toFixed(2))
        })).reverse();

        // Top Selling Products
        const salesStats: { [key: string]: { name: string; qty: number; total: number; size?: string } } = {};
        lastTrans.forEach(t => {
          const id = t.product_id;
          const name = t.products?.name || 'Desconhecido';
          const size = t.products?.size || '';
          const qty = Number(t.quantity) || 0;
          const price = Number(t.products?.sale_price) || Number(t.products?.price) || 0;
          
          if (!salesStats[id]) {
            salesStats[id] = { name, qty: 0, total: 0, size };
          }
          salesStats[id].qty += qty;
          salesStats[id].total += (qty * price);
        });
        const topSelling = Object.values(salesStats).sort((a, b) => b.qty - a.qty).slice(0, 5);

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header & General Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div>
                <h2 className="text-xl font-black text-gray-900">Relatórios & Análise de Vendas</h2>
                <p className="text-xs text-gray-500">Acompanhe métricas financeiras, vendas e níveis críticos de estoque.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {[
                    { id: 'today', label: 'Hoje' },
                    { id: 'week', label: '7 Dias' },
                    { id: 'month', label: '30 Dias' },
                    { id: 'all', label: 'Tudo' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setReportPeriod(p.id as any)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                        reportPeriod === p.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPrintMode('report');
                    setTimeout(() => {
                      window.print();
                    }, 150);
                  }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-md shadow-blue-100"
                >
                  <FileText size={14} className="mr-2" /> Exportar PDF (A4)
                </button>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs font-black text-slate-400 uppercase">Receita Total</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-gray-900">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs font-black text-slate-400 uppercase">Itens Vendidos</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-gray-900">{qtySold} un</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs font-black text-slate-400 uppercase">Custo Geral de Estoque</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-gray-900">R$ {totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 bg-red-50/15">
                <p className="text-xs font-black text-red-500 uppercase">Estoque Crítico</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-red-700">{lowStockItems.length} itens</span>
                </div>
              </div>
            </div>

            {/* Charts & Top lists */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Sales Chart */}
              <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-start">
                <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Desempenho de Vendas (R$)</h3>
                {chartData.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400 text-xs text-center min-h-[220px]">
                    Sem movimentações financeiras no período.
                  </div>
                ) : (
                  <div className="h-64 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip formatter={(value) => [`R$ ${Number(value).toFixed(2)}`, 'Vendas']} />
                        <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Best Sellers */}
              <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Produtos Mais Vendidos</h3>
                {topSelling.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 text-xs">Nenhuma venda registrada.</div>
                ) : (
                  <div className="space-y-4">
                    {topSelling.map((p, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition">
                        <div>
                          <p className="font-bold text-xs text-gray-900 leading-tight">{p.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{p.size ? `Tamanho: ${p.size}` : 'Sem tamanho'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-blue-600">{p.qty} un</p>
                          <p className="text-[10px] font-semibold text-gray-400">R$ {p.total.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Critical Stock list */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider text-red-650 flex items-center">
                Atenção de Reposição de Estoque
              </h3>
              {lowStockItems.length === 0 ? (
                <div className="py-8 text-center text-sm font-semibold text-green-600 bg-green-50/50 rounded-xl">
                  ✓ Todos os produtos estão com níveis de estoque saudáveis!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-500">
                    <thead className="bg-slate-50 uppercase text-[10px] text-slate-500 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-extrabold text-slate-800">Produto</th>
                        <th className="px-4 py-3 font-extrabold text-slate-800">Tamanho</th>
                        <th className="px-4 py-3 font-extrabold text-slate-800">Categoria</th>
                        <th className="px-4 py-3 font-extrabold text-slate-800 text-center">Mínimo desejado</th>
                        <th className="px-4 py-3 font-extrabold text-slate-800 text-center">Físico Atual</th>
                        <th className="px-4 py-3 font-extrabold text-slate-800 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lowStockItems.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-900">{p.name}</td>
                          <td className="px-4 py-3 font-semibold">{p.size || 'Único'}</td>
                          <td className="px-4 py-3">{p.category}</td>
                          <td className="px-4 py-3 text-center text-slate-400">{p.min_stock || 5}</td>
                          <td className="px-4 py-3 text-center bg-red-50/30">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md font-extrabold">
                              {p.stock} un
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProduct(p);
                                setStockAction('entry');
                                setQuantity(10);
                                setIsStockModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-black transition text-[10px]"
                            >
                              Repor Estoque
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
            {demands.map((demand) => {
              const displayPriority = demand.priority === 'high' || demand.priority === 'Alta' ? 'Alta' :
                                      demand.priority === 'low' || demand.priority === 'Baixa' ? 'Baixa' : 'Média';
              const displayStatus = demand.status === 'pending' || demand.status === 'Pendente' ? 'Pendente' :
                                    demand.status === 'in_progress' || demand.status === 'Em Progresso' ? 'Em Progresso' : 'Concluído';
              return (
                <div key={demand.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      displayPriority === 'Alta' ? "bg-red-100 text-red-650" : 
                      displayPriority === 'Média' ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"
                    )}>
                      {displayPriority}
                    </span>
                    <span className="text-xs text-gray-400">
                      {demand.created_at ? format(new Date(demand.created_at), 'dd/MM') : ''}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 mb-2">{demand.title}</h4>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{demand.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {demand.acknowledged_by && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-700">{demand.acknowledged_by} leu</span>
                    )}
                    {demand.purchased_by && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-green-100 text-green-700">{demand.purchased_by} comprou</span>
                    )}
                    {demand.frozen && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-100 text-cyan-700">{demand.frozen_by ? `${demand.frozen_by} congelou` : 'Congelada'}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <span className="text-xs font-medium text-gray-400">Status: {displayStatus}</span>
                    <button 
                      onClick={() => {
                        setSelectedDemand(demand);
                        setIsDemandDetailsModalOpen(true);
                      }}
                      className="text-blue-600 text-xs font-bold hover:underline"
                    >
                      Ver Detalhes
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'configuracoes' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Gestão de usuários da lojinha (ver e criar usuários) */}
          <Users />
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
                  setShowPrintModal(false);
                  setTimeout(() => window.print(), 100);
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

      {isDemandDetailsModalOpen && selectedDemand && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 animate-in fade-in duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={cn(
                  "px-2 py-1 rounded-full text-[10px] font-bold uppercase mr-2",
                  selectedDemand.priority === 'high' || selectedDemand.priority === 'Alta' ? "bg-red-100 text-red-650" : 
                  selectedDemand.priority === 'low' || selectedDemand.priority === 'Baixa' ? "bg-blue-100 text-blue-600" : "bg-yellow-100 text-yellow-600"
                )}>
                  Prioridade: {selectedDemand.priority === 'high' || selectedDemand.priority === 'Alta' ? 'Alta' : selectedDemand.priority === 'low' || selectedDemand.priority === 'Baixa' ? 'Baixa' : 'Média'}
                </span>
                <span className="text-xs text-gray-400">
                  {selectedDemand.created_at ? format(new Date(selectedDemand.created_at), 'dd/MM/yyyy HH:mm') : ''}
                </span>
              </div>
              <button 
                onClick={() => setIsDemandDetailsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedDemand.title}</h3>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6 max-h-[200px] overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedDemand.description}</p>
            </div>

            {/* Ciência / Compra / Congelar (Édson e equipe) */}
            <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {selectedDemand.acknowledged_by ? (
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-bold">
                    {selectedDemand.acknowledged_by} marcou como Lido{selectedDemand.acknowledged_at ? ` • ${format(new Date(selectedDemand.acknowledged_at), 'dd/MM HH:mm')}` : ''}
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500 font-bold">Ainda não lido</span>
                )}
                {selectedDemand.purchased_by && (
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 font-bold">
                    {selectedDemand.purchased_by} marcou como Comprado{selectedDemand.purchased_at ? ` • ${format(new Date(selectedDemand.purchased_at), 'dd/MM')}` : ''}
                  </span>
                )}
                {selectedDemand.frozen && (
                  <span className="px-2 py-1 rounded-full bg-cyan-100 text-cyan-700 font-bold">
                    {selectedDemand.frozen_by ? `${selectedDemand.frozen_by} congelou` : 'Congelada (sazonal)'}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {!selectedDemand.acknowledged_by && (
                  <button
                    type="button"
                    onClick={() => handleAcknowledgeDemand(selectedDemand)}
                    className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <Eye size={14} /> Marcar como lido
                  </button>
                )}
                {selectedDemand.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => handleConfirmPurchase(selectedDemand)}
                    className="px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <ShoppingCart size={14} /> Confirmar compra
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleFreezeDemand(selectedDemand)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5",
                    selectedDemand.frozen ? "bg-cyan-600 text-white hover:bg-cyan-700" : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                  )}
                >
                  <Snowflake size={14} /> {selectedDemand.frozen ? 'Descongelar' : 'Congelar (sazonal)'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alterar Status</label>
                <div className="flex gap-2">
                  {['pending', 'in_progress', 'completed'].map((statusValue) => {
                    const label = statusValue === 'pending' ? 'Pendente' : statusValue === 'in_progress' ? 'Em Progresso' : 'Concluído';
                    const isSelected = selectedDemand.status === statusValue;
                    return (
                      <button
                        key={statusValue}
                        type="button"
                        onClick={() => handleUpdateDemandStatus(selectedDemand.id, statusValue)}
                        className={cn(
                          "flex-1 py-2 text-xs font-bold rounded-lg transition-all border",
                          isSelected 
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-gray-100 gap-3">
                <button
                  type="button"
                  onClick={() => handleDeleteDemand(selectedDemand.id)}
                  className="px-4 py-2 bg-red-50 text-red-650 hover:bg-red-105 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Excluir Demanda
                </button>
                <button
                  type="button"
                  onClick={() => setIsDemandDetailsModalOpen(false)}
                  className="px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edição de valores em massa */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-1">Editar valores em massa</h2>
            <p className="text-sm text-gray-500 mb-6">
              Aplica os valores marcados a <strong>{selectedProductIds.size}</strong> produto(s) selecionado(s).
              Útil quando itens iguais (ex.: blusões de vários tamanhos) têm o mesmo preço.
            </p>
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-gray-200">
                <label className="flex items-center gap-2 mb-2 font-semibold text-sm text-gray-700">
                  <input type="checkbox" checked={bulkApplyPurchase} onChange={(e) => setBulkApplyPurchase(e.target.checked)} className="rounded text-indigo-600" />
                  Alterar Valor de Compra (custo)
                </label>
                <input
                  type="number" step="0.01" disabled={!bulkApplyPurchase}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg disabled:bg-gray-50 disabled:text-gray-400"
                  value={bulkPurchasePrice || ''}
                  onChange={(e) => setBulkPurchasePrice(parseFloat(e.target.value) || 0)}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="p-3 rounded-xl border border-gray-200">
                <label className="flex items-center gap-2 mb-2 font-semibold text-sm text-gray-700">
                  <input type="checkbox" checked={bulkApplySale} onChange={(e) => setBulkApplySale(e.target.checked)} className="rounded text-indigo-600" />
                  Alterar Valor de Venda
                </label>
                <input
                  type="number" step="0.01" disabled={!bulkApplySale}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg disabled:bg-gray-50 disabled:text-gray-400"
                  value={bulkSalePrice || ''}
                  onChange={(e) => setBulkSalePrice(parseFloat(e.target.value) || 0)}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-6">
              <button onClick={() => setIsBulkEditOpen(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium">Cancelar</button>
              <button onClick={handleBulkPriceUpdate} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Aplicar a todos</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo pedido de doação (chefe) */}
      {isDonationReqModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-1">Novo pedido de doação</h2>
            <p className="text-sm text-gray-500 mb-6">O pedido vira uma tarefa para a equipe da lojinha realizar a doação.</p>
            <form onSubmit={handleCreateDonationRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Jovem</label>
                <input required type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newDonationReq.youth_name} onChange={(e) => setNewDonationReq({ ...newDonationReq, youth_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item a doar</label>
                <select required className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newDonationReq.product_id} onChange={(e) => setNewDonationReq({ ...newDonationReq, product_id: e.target.value })}>
                  <option value="">Selecione o produto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.size ? ` (${p.size})` : ''} — estoque: {p.stock}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input type="number" min="1" className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newDonationReq.quantity} onChange={(e) => setNewDonationReq({ ...newDonationReq, quantity: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
                <textarea rows={2} className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newDonationReq.notes} onChange={(e) => setNewDonationReq({ ...newDonationReq, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsDonationReqModalOpen(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">Criar pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Aprovação de fiado via WhatsApp */}
      {pendingFiadoApproval && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Clock size={22} /></div>
              <h2 className="text-xl font-bold">Fiado registrado — enviar p/ aprovação</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Envie a solicitação de aprovação para o Édson e a Juliana pelo WhatsApp.
            </p>
            <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-sm mb-4">
              <p><strong>Chefe:</strong> {pendingFiadoApproval.chefe_name}</p>
              <p><strong>Valor:</strong> R$ {Number(pendingFiadoApproval.total_amount || 0).toFixed(2)}</p>
              <p><strong>Vencimento:</strong> {pendingFiadoApproval.due_date ? format(new Date(pendingFiadoApproval.due_date + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</p>
            </div>

            <p className="text-[11px] text-gray-400 mb-4">Os números do Édson e da Juliana já estão configurados. É só clicar para enviar.</p>

            <div className="flex flex-col gap-2">
              <a
                href={buildWaLink(WA_EDSON, fiadoApprovalMessage(pendingFiadoApproval))}
                target="_blank" rel="noreferrer"
                className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} /> Enviar p/ Chefe Édson (WhatsApp)
              </a>
              <a
                href={buildWaLink(WA_JULIANA, fiadoApprovalMessage(pendingFiadoApproval))}
                target="_blank" rel="noreferrer"
                className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} /> Enviar p/ Juliana (WhatsApp)
              </a>
              <button onClick={() => setPendingFiadoApproval(null)} className="w-full py-2 text-gray-500 hover:bg-gray-50 rounded-xl text-sm font-medium mt-1">
                Fechar
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
