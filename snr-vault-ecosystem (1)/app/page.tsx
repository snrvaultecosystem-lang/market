'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, X, CheckCircle2, AlertCircle, Zap, ShieldCheck, 
  LogOut, Loader2, Activity, History, Package, ExternalLink,
  ChevronRight, ArrowUpRight, BarChart3, Terminal, Trophy, Settings
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { connectWallet, getWalletBalance, SNR_VAULT_ADDRESS, transferTokens } from '@/lib/web3';
import { supabase } from '@/lib/supabase';

// Motorcycle database
const motorcycles = [
  {
    id: 1,
    classTitle: 'ENTRY CLASS',
    name: 'Moped Dynamic Edition',
    otr: 'Rp 18.000.000',
    price: 2390,
    img: 'https://picsum.photos/seed/moped/400/300'
  },
  {
    id: 2,
    classTitle: 'STANDARD CLASS',
    name: 'Scooter Urban Gen-V',
    otr: 'Rp 22.000.000',
    price: 2921,
    img: 'https://picsum.photos/seed/scooter/400/300'
  },
  {
    id: 3,
    classTitle: 'PREMIUM CLASS',
    name: 'Maxi Cruise Fortress',
    otr: 'Rp 38.000.000',
    price: 5045,
    img: 'https://picsum.photos/seed/maxiscooter/400/300'
  },
  {
    id: 4,
    classTitle: 'SPORT CLASS',
    name: 'SNR Racing Visionary',
    otr: 'Rp 45.000.000',
    price: 5975,
    img: 'https://picsum.photos/seed/sportbike/400/300'
  }
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0); 
  const [selectedItem, setSelectedItem] = useState<(typeof motorcycles)[0] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isMobile = useIsMobile();
  const [toastMessage, setToastMessage] = useState<{title: string, type: 'success'|'error'} | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState<'idle' | 'witnessing' | 'confirming' | 'finalizing'>('idle');
  
  const [globalStock, setGlobalStock] = useState<Record<number, number>>({});
  const [userTx, setUserTx] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<{address: string, count: number}[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Check if current user is admin (using the Vault address as the owner for demo)
  const isOwner = address?.toLowerCase() === SNR_VAULT_ADDRESS.toLowerCase();

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('wallet_address');
      
      if (error) throw error;
      
      if (data) {
        // Group by address manually because Supabase client grouping is tricky
        const counts: Record<string, number> = {};
        data.forEach(t => {
          counts[t.wallet_address] = (counts[t.wallet_address] || 0) + 1;
        });
        
        const sorted = Object.entries(counts)
          .map(([address, count]) => ({ address, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
          
        setLeaderboard(sorted);
      }
    } catch (e) {
      console.error('Leaderboard error:', e);
    }
  };

  // Fetch products and stock from Supabase
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, stock');
        
        if (error) {
          console.warn('Products table might not exist yet, using local defaults');
          setGlobalStock({ 1: 4, 2: 7, 3: 2, 4: 1 });
          return;
        }

        if (data) {
          const stockMap: Record<number, number> = {};
          data.forEach(p => stockMap[p.id] = p.stock);
          setGlobalStock(stockMap);
        }
      } catch (e) {
        console.error('Failed to fetch products:', e);
        setGlobalStock({ 1: 4, 2: 7, 3: 2, 4: 1 });
      }
    };

    fetchProducts();
    fetchLeaderboard();

    // Subscribe to stock changes
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          setIsSyncing(true);
          setGlobalStock(prev => ({
            ...prev,
            [payload.new.id]: payload.new.stock
          }));
          setLogs(prev => [`Stock Update Detected: Product ${payload.new.id}`, ...prev.slice(0, 5)]);
          setTimeout(() => setIsSyncing(false), 2000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions'
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const showToast = useCallback((title: string, type: 'success' | 'error') => {
    setToastMessage({ title, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const fetchBalance = useCallback(async (walletAddress: string) => {
    try {
      const bal = await getWalletBalance(walletAddress);
      setBalance(bal);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Load history from Supabase when address changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (address) {
        try {
          const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('wallet_address', address)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          if (data) {
            setUserTx(data.map(tx => ({
              id: tx.id,
              item: tx.item_name,
              price: tx.price,
              date: tx.created_at,
              txHash: tx.tx_hash
            })));
          }
        } catch (error) {
          console.error('Error fetching Supabase history:', error);
          // Fallback to local storage if supabase fails or table not ready
          const savedTx = localStorage.getItem(`snr_tx_${address}`);
          if (savedTx) setUserTx(JSON.parse(savedTx));
        }
      }
    };
    fetchHistory();
  }, [address]);

  useEffect(() => {
    if (address && address.startsWith('0x')) {
      requestAnimationFrame(() => fetchBalance(address));
      const interval = setInterval(() => fetchBalance(address), 10000);
      return () => clearInterval(interval);
    }
  }, [address, fetchBalance]);

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) setAddress(accounts[0]);
        } catch (e) {
          console.error(e);
        }
      }
      setAuthLoading(false);
    };
    checkConnection();

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccounts = (accounts: string[]) => {
        if (accounts.length > 0) setAddress(accounts[0]);
        else setAddress(null);
      };
      const handleChain = () => window.location.reload();

      (window as any).ethereum.on('accountsChanged', handleAccounts);
      (window as any).ethereum.on('chainChanged', handleChain);

      return () => {
        if ((window as any).ethereum.removeListener) {
          (window as any).ethereum.removeListener('accountsChanged', handleAccounts);
          (window as any).ethereum.removeListener('chainChanged', handleChain);
        }
      };
    }
  }, []);

  const handleWalletConnect = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      showToast('Wallet tidak terdeteksi! Gunakan browser TokenPocket.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const connectedAddress = await connectWallet();
      setAddress(connectedAddress);
      showToast('Wallet Terkoneksi ke BSC!', 'success');
    } catch (error: any) {
      showToast(error.message || 'Gagal koneksi Wallet', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedItem || !address) return;

    if (address === 'guest_mode' || address === 'demo_mode_active') {
      showToast('Gunakan Wallet Asli untuk transaksi BSC!', 'error');
      return;
    }

    if (balance < selectedItem.price) {
      showToast('Saldo SNR-VAULT Anda di BSC tidak mencukupi!', 'error');
      setSelectedItem(null);
      return;
    }

    const currentStock = globalStock[selectedItem.id] ?? 0;
    if (currentStock <= 0) {
      showToast('Gagal! Kuota produk ini sudah habis.', 'error');
      setSelectedItem(null);
      return;
    }

    setIsProcessing(true);
    setPurchaseStep('witnessing');
    try {
      // 1. EXECUTE REAL BSC TRANSACTION
      setLogs(prev => ['Broadcasting transaction to BSC...', ...prev.slice(0, 5)]);
      showToast('Menunggu konfirmasi wallet...', 'success');
      
      const hash = await transferTokens(SNR_VAULT_ADDRESS, selectedItem.price);
      setPurchaseStep('confirming');
      setLogs(prev => [`Transaction Hash: ${hash}`, 'Confirming on BSC...', ...prev.slice(0, 5)]);
      
      // 2. Update Stock in Supabase
      setPurchaseStep('finalizing');
      const { error: stockError } = await supabase
        .from('products')
        .update({ stock: currentStock - 1 })
        .eq('id', selectedItem.id);

      if (stockError) console.error('Failed to update stock in DB:', stockError);

      // 3. Save Transaction to Supabase
      const { data, error: txError } = await supabase
        .from('transactions')
        .insert([
          {
            wallet_address: address,
            item_name: selectedItem.name,
            price: selectedItem.price,
            tx_hash: hash
          }
        ])
        .select();

      if (txError) throw txError;

      // 4. Update local state
      const newTx = {
        id: data[0].id,
        item: data[0].item_name,
        price: data[0].price,
        date: data[0].created_at,
        txHash: hash
      };
      
      const updatedHistory = [newTx, ...userTx];
      setUserTx(updatedHistory);
      setLogs(prev => [`Swap Executed: ${selectedItem.name}`, ...prev.slice(0, 5)]);
      
      setSelectedItem(null);
      showToast(`Sukses! Saldo SNR terpotong & Transaksi tercatat: ${hash.slice(0,10)}...`, 'success');
      
      // Refresh balance and leaderboard
      fetchBalance(address);
      fetchLeaderboard();
    } catch (error: any) {
      setLogs(prev => [`Transaction Failed: ${error.message}`, ...prev.slice(0, 5)]);
      showToast(`Transaksi Gagal: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setPurchaseStep('idle');
    }
  };

  // Simulated node logs for visual "Dashboard" feel
  const [logs, setLogs] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  useEffect(() => {
    if (!address) return;
    const messages = [
      `[SYS] Handshake with BSC node finalized`,
      `[AUTH] Wallet ${address.slice(0,6)}... detected`,
      `[NET] Latency: ${Math.floor(Math.random() * 50) + 10}ms`,
      `[CHAIN] SNR-VAULT contract sync complete`,
    ];
    requestAnimationFrame(() => setLogs(messages));
    
    const interval = setInterval(() => {
      const newLog = `[BC] Tx block ${Math.floor(Math.random() * 1000000)} verified - ${new Date().toLocaleTimeString()}`;
      setLogs(prev => [newLog, ...prev].slice(0, 5));
    }, 8000);
    return () => clearInterval(interval);
  }, [address]);

  const [isCopied, setIsCopied] = useState(false);

  const copyAppUrl = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link berhasil disalin!', 'success');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e4e3e0] font-sans selection:bg-gold selection:text-black">
      <AnimatePresence>
        {/* Wallet Support Help */}
        {!(window as any).ethereum && !address && (
          <motion.div
            key="wallet-help-banner"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-[#111]/90 border border-[#333] p-6 rounded-2xl shadow-2xl backdrop-blur-xl w-[95%] max-w-[450px]"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="bg-gold/10 p-2.5 rounded-xl border border-gold/20">
                <AlertCircle className="text-gold" size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-orbitron font-bold text-white text-sm mb-1 tracking-wider uppercase">Wallet Provider Not Found</h4>
                <p className="text-[#888] text-[10px] leading-relaxed uppercase tracking-tight">
                  Jika Anda menggunakan Browser biasa, silakan salin link dan buka di <b>TokenPocket</b>. Jika sudah di TokenPocket, klik tombol Hubungkan di bawah.
                </p>
              </div>
              <button 
                onClick={() => setAddress('demo_mode_active')} 
                className="text-[#444] hover:text-white transition-colors p-1"
                title="Sembunyikan"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button 
                id="connect-wallet-btn-banner"
                onClick={handleWalletConnect}
                className="bg-[#222] border border-[#333] text-white font-bold py-3 rounded-xl text-[10px] hover:bg-[#333] transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Wallet size={14} />
                HUBUNGKAN
              </button>
              <button 
                id="copy-portal-link-btn-banner"
                onClick={copyAppUrl}
                className={`${isCopied ? 'bg-green-500 text-white' : 'bg-gold text-black'} font-bold py-3 rounded-xl text-[10px] hover:opacity-90 transition-all flex items-center justify-center gap-2 uppercase tracking-widest`}
              >
                {isCopied ? (
                  <>
                    <CheckCircle2 size={14} />
                    SUDAH DISALIN
                  </>
                ) : (
                  'SALIN LINK PORTAL'
                )}
              </button>
            </div>
            
            <button
              id="browse-as-guest-btn-banner"
              onClick={() => setAddress('guest_mode')}
              className="w-full py-2 text-[9px] text-[#555] hover:text-white transition-colors uppercase tracking-[0.2em] font-orbitron"
            >
              MODE LIHAT-LIHAT (Guest)
            </button>
          </motion.div>
        )}

        {toastMessage && (
          <motion.div
            key="global-toast-notification"
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className={`fixed top-20 left-1/2 z-[300] flex items-center gap-3 px-6 py-4 rounded-xl border shadow-2xl backdrop-blur-md w-[90%] md:w-auto ${
              toastMessage.type === 'success' 
                ? 'border-green-500/30 bg-green-500/10 text-green-400' 
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="font-bold text-sm font-orbitron uppercase tracking-widest flex-1">{toastMessage.title}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            key="purchase-confirmation-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-center justify-center p-5 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              key="purchase-confirmation-card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0c0c0c] border border-[#333] rounded-3xl p-8 w-full max-w-[450px] relative shadow-3xl"
            >
              <button 
                onClick={() => !isProcessing && setSelectedItem(null)}
                className="absolute top-6 right-6 text-[#666] hover:text-white transition-colors"
                disabled={isProcessing}
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gold/10 p-2 rounded-lg">
                  <ShieldCheck className="text-gold" size={24} />
                </div>
                <div>
                  <h3 className="font-orbitron text-lg font-bold text-white tracking-widest">KONFIRMASI <span className="text-gold">TOKEN</span></h3>
                  <p className="text-[#666] text-xs">Authorize SNR-VAULT on BSC</p>
                </div>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-2xl p-4 mb-6 flex items-center gap-4">
                <div className="w-20 h-14 rounded-xl overflow-hidden relative border border-[#333]">
                  <Image src={selectedItem.img} alt={selectedItem.name} fill className="object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase text-gold font-bold mb-1 opacity-70 tracking-widest">{selectedItem.classTitle}</div>
                  <div className="font-bold text-white leading-tight text-sm truncate uppercase tracking-tighter">{selectedItem.name}</div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#666] uppercase tracking-widest text-[10px]">Swap Cost</span>
                  <span className="font-orbitron font-bold text-[#ff4444]">-{selectedItem.price.toLocaleString('id-ID')} <span className="text-[10px]">SNR</span></span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-[#222] pt-4">
                  <span className="text-[#666] uppercase tracking-widest text-[10px]">Your Wallet Balance</span>
                  <span className="font-orbitron font-bold text-[#00ff88]">{balance.toLocaleString('id-ID')} <span className="text-[10px]">SNR</span></span>
                </div>
              </div>

              <button
                onClick={handlePurchase}
                disabled={isProcessing}
                className="w-full bg-[#e4e3e0] text-black font-orbitron font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gold transition-all shadow-lg active:scale-95 disabled:opacity-50 px-6"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-center">
                      {purchaseStep === 'witnessing' && 'AWAITING WALLET...'}
                      {purchaseStep === 'confirming' && 'CONFIRMING BSC...'}
                      {purchaseStep === 'finalizing' && 'FINALIZING DB...'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <Zap size={20} fill="currentColor" className="shrink-0" />
                    <span className="whitespace-nowrap md:whitespace-normal">EXECUTE SWAP CONTRACT</span>
                  </div>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              key="history-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[450]"
            />
            <motion.div
              key="history-sidebar-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-[400px] bg-[#0c0c0c] border-l border-[#222] z-[500] p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <History className="text-gold" size={24} />
                  <h3 className="font-orbitron font-bold text-white tracking-widest">TRANSACTION LOGS</h3>
                </div>
                <button onClick={() => setShowHistory(false)} className="text-[#666] hover:text-white"><X size={24} /></button>
              </div>

              <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-160px)] pr-2 custom-scrollbar">
                {userTx.length === 0 ? (
                  <div className="text-center py-20 text-[#444]">
                    <Activity className="mx-auto mb-4 opacity-20" size={48} />
                    <p className="text-xs uppercase tracking-widest">No transactions detected</p>
                  </div>
                ) : (
                  userTx.map((tx) => (
                    <div key={tx.id} className="bg-[#111] border border-[#222] p-4 rounded-2xl group hover:border-gold/30 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-white font-bold uppercase tracking-widest">{tx.item}</span>
                        <span className="text-[10px] text-gold font-mono">{new Date(tx.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-[#666]">{tx.id}</span>
                        <span className="text-xs font-orbitron font-bold text-red-500">-{tx.price} SNR</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#222] flex items-center justify-between">
                        <span className="text-[9px] text-[#444] font-mono truncate max-w-[200px]">{tx.txHash}</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(tx.txHash);
                              showToast('Hash disalin!', 'success');
                            }}
                            className="text-[#333] hover:text-white transition-colors"
                            title="Salin Hash"
                          >
                            <Terminal size={12} />
                          </button>
                          <a 
                            href={`https://bscscan.com/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#444] hover:text-gold transition-colors"
                            title="Lihat di BscScan"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className="px-[5%] py-3 md:py-6 flex justify-between items-center border-b border-[#222] backdrop-blur-xl sticky top-0 z-[100] bg-[#050505]/80">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-gold p-1 md:p-1.5 rounded-lg text-black">
            <ShieldCheck size={18} />
          </div>
          <div className="font-orbitron text-lg md:text-xl font-black tracking-tighter text-white">
            <span className="text-gold">SNR</span>-VAULT
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {address && (
            <button 
              onClick={() => setShowHistory(true)}
              className="p-1.5 md:p-2 text-[#666] hover:text-gold transition-colors relative"
            >
              <History size={18} />
              {userTx.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-gold rounded-full" />}
            </button>
          )}

          {authLoading ? (
            <div className="flex items-center gap-2 text-[#444] text-[8px] md:text-[10px] font-orbitron tracking-widest">
              <Loader2 size={10} className="animate-spin" />
              STABILIZING...
            </div>
          ) : address ? (
            <div className="flex items-center gap-2 md:gap-3">
              {isOwner && (
                <button 
                  onClick={() => setShowAdminModal(true)}
                  className="bg-gold/10 text-gold p-1.5 md:p-2 rounded-xl border border-gold/20 hover:bg-gold hover:text-black transition-all"
                  title="Admin Dashboard"
                >
                  <Settings size={14} />
                </button>
              )}
              <div className="bg-[#111] border border-[#222] px-2 md:px-4 py-1.5 md:py-2 rounded-full flex items-center gap-2 md:gap-3 transition-all">
                <div className="flex flex-col items-end">
                  <span className="hidden md:block text-[9px] text-[#666] uppercase font-bold tracking-widest leading-none mb-1">
                    Authenticated BSC
                  </span>
                  <span className="text-[10px] md:text-xs font-mono font-bold text-white leading-none">
                    {address === 'guest_mode' ? 'GUEST' : address === 'demo_mode_active' ? 'DEMO' : formatAddress(address)}
                  </span>
                </div>
                <div className="w-[1px] h-4 md:h-6 bg-[#222]" />
                <div className="flex flex-col">
                  <span className="hidden md:block text-[9px] text-[#666] uppercase font-bold tracking-widest leading-none mb-1">Balance</span>
                  <span className="text-[10px] md:text-xs font-orbitron font-bold text-gold leading-none">
                    {address.startsWith('0x') ? `${balance.toFixed(1)} SNR` : 'READ ONLY'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setAddress(null)}
                className="bg-[#222] text-[#666] p-1.5 md:p-2 rounded-xl hover:bg-red-900/20 hover:text-red-500 transition-all"
                title="Keluar"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleWalletConnect}
              disabled={isProcessing}
              className="bg-[#e4e3e0] text-black font-orbitron font-bold px-4 md:px-6 py-2 md:py-2.5 rounded-xl flex items-center gap-2 text-[10px] md:text-xs hover:bg-gold transition-all shadow-xl active:scale-95"
            >
              {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={14} />}
              CONNECT
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Hero & Info */}
          <div className="lg:col-span-4 space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 bg-gold/10 px-3 py-1.5 rounded-lg border border-gold/20">
                <Activity size={14} className="text-gold" />
                <span className="text-[10px] text-gold font-bold font-orbitron uppercase tracking-widest">Mainnet Node Live</span>
              </div>
              
              <h1 className="font-orbitron text-3xl md:text-5xl lg:text-6xl font-black leading-[0.95] text-white">
                THE <br /> <span className="text-gold">FUTURE</span> <br /> OF REWARDS
              </h1>
              
              <p className="text-[#888] text-sm leading-relaxed max-w-[350px]">
                Integrasi blockchain Binance Smart Chain memberikan transparansi penuh untuk setiap penukaran koin SNR-VAULT.
              </p>

              <div className="pt-8 space-y-4">
                <div className="p-5 bg-[#0c0c0c] border border-[#222] rounded-2xl group hover:border-[#333] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/5 p-2 rounded-lg"><ShieldCheck size={20} className="text-white/60" /></div>
                      <span className="text-xs font-bold uppercase tracking-widest">Contract Verified</span>
                    </div>
                    <a 
                      href={`https://bscscan.com/address/${SNR_VAULT_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#444] hover:text-gold transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <div className="text-[10px] font-mono text-[#444] break-all group-hover:text-[#666] transition-colors">
                    {SNR_VAULT_ADDRESS}
                  </div>
                </div>

                <div className="p-5 bg-gradient-to-br from-gold/5 to-transparent border border-gold/10 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BarChart3 size={18} className={isSyncing ? "text-gold animate-pulse" : "text-gold"} />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#888]">Protocol Status</span>
                </div>
                <div className="flex items-center gap-2">
                  {isSyncing && <Loader2 size={10} className="animate-spin text-gold" />}
                  <span className="text-[10px] font-bold text-gold uppercase tracking-widest">
                    {isSyncing ? 'Synchronizing...' : 'Active'}
                  </span>
                </div>
              </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase font-bold">
                      <span className="text-[#444]">Sync Latency</span>
                      <span className="text-white">~0.4s</span>
                    </div>
                    <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ x: [-100, 100] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="w-1/3 h-full bg-gold"
                      />
                    </div>
                  </div>
                </div>

                {/* Node Activity Log */}
                {address && (
                  <div className="p-5 bg-black border border-[#222] rounded-2xl">
                    <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-[#444] uppercase tracking-widest border-b border-[#111] pb-2">
                      <Terminal size={12} />
                      Node Activity Stream
                    </div>
                    <div className="space-y-1.5 min-h-[100px]">
                      {logs.map((log, i) => (
                        <motion.div 
                          key={`log-${i}-${log.slice(0, 10)}`}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-[9px] font-mono text-gold/60 flex gap-2"
                        >
                          <span className="text-[#333] shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                          <span className="truncate">{log}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Real-time Leaderboard */}
                <div className="p-5 bg-gradient-to-br from-[#111] to-black border border-[#222] rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-widest">
                      <Trophy size={14} className="text-gold" />
                      Community Leaderboard
                    </div>
                    <span className="text-[8px] text-[#444] font-mono">UPDATES REALTIME</span>
                  </div>
                  
                  <div className="space-y-3">
                    {leaderboard.length === 0 ? (
                      <div className="text-[10px] text-[#333] text-center py-4 uppercase tracking-widest">Awaiting chain data...</div>
                    ) : (
                      leaderboard.map((user, i) => (
                        <div key={user.address} className="flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <span className={`text-[9px] font-bold ${i === 0 ? 'text-gold' : 'text-[#333]'}`}>0{i+1}</span>
                            <span className="text-[10px] font-mono text-[#888] group-hover:text-white transition-colors">
                              {formatAddress(user.address)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-white">
                            <span className="text-[10px] font-bold">{user.count}</span>
                            <Package size={10} className="text-gold/50" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Grid */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-8 border-b border-[#222] pb-6">
              <div className="flex items-center gap-4">
                <Package size={24} className="text-gold" />
                <h2 className="font-orbitron text-2xl font-bold uppercase tracking-widest">Available Assets</h2>
              </div>
              <div className="text-[10px] text-[#444] font-bold uppercase tracking-widest">
                Network: BNB Smart Chain
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {motorcycles.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-[#0c0c0c] border border-[#222] rounded-3xl overflow-hidden group hover:border-gold/40 transition-all flex flex-col"
                >
                  <div className="aspect-[1.8/1] relative overflow-hidden bg-black">
                    <Image 
                      src={item.img} 
                      alt={item.name} 
                      fill 
                      className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1 rounded-md border border-[#333] text-[9px] font-black text-gold uppercase tracking-widest">
                      {item.classTitle}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <div className={`bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-md border transition-all ${globalStock[item.id] <= 2 ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'border-[#333]'}`}>
                        <div className="text-[8px] text-[#666] uppercase font-bold tracking-widest mb-0.5">Availability</div>
                        <div className={`text-[10px] font-bold ${globalStock[item.id] <= 2 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                          {globalStock[item.id]} UNITS LEFT
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-white uppercase tracking-tighter leading-tight">{item.name}</h3>
                        <div className="bg-white/5 p-1 rounded hover:bg-gold/10 transition-colors cursor-pointer"><ChevronRight size={14} className="text-[#444] group-hover:text-gold" /></div>
                      </div>
                      <p className="text-xs text-[#666] font-mono">{item.otr}</p>
                    </div>

                    <div className="bg-[#111] border border-[#222] p-4 rounded-2xl flex justify-between items-center group-hover:bg-gold/5 transition-colors">
                      <div>
                        <div className="text-[9px] text-[#444] uppercase font-bold tracking-widest mb-1">Exchange Rate</div>
                        <div className="font-orbitron font-bold text-xl text-gold">
                          {item.price.toLocaleString('id-ID')} <span className="text-xs">SNR</span>
                        </div>
                        <div className="text-[9px] text-[#555] font-mono mt-0.5 italic">
                          (Estimated Value: {item.otr})
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (!address) {
                            showToast('Authorize Wallet to swap!', 'error');
                            handleWalletConnect();
                          } else {
                            setSelectedItem(item);
                          }
                        }}
                        className="bg-[#222] text-white/50 p-3 rounded-2xl group-hover:bg-gold group-hover:text-black transition-all shadow-xl active:scale-95"
                      >
                        <ArrowUpRight size={20} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <footer className="mt-24 pt-12 border-t border-[#222]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-gold/40" size={20} />
              <div className="text-[10px] text-[#444] uppercase font-bold tracking-widest">
                Protected by BSC Protocol Encryption &copy; 2026 SNR-VAULT
              </div>
            </div>
            <div className="flex gap-6 text-[10px] text-[#444] uppercase font-bold tracking-widest">
              <a href="#" className="hover:text-gold transition-colors">Whitepaper</a>
              <a href="#" className="hover:text-gold transition-colors">Contract Audit</a>
              <a href="#" className="hover:text-gold transition-colors">BSC Scan</a>
            </div>
          </div>
        </footer>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&family=Orbitron:wght@400;500;600;700;800;900&display=swap');
        
        .font-sans { font-family: 'Inter', sans-serif; }
        .font-orbitron { font-family: 'Orbitron', sans-serif; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }

        @keyframes pulse-red {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.98); }
        }
        .animate-pulse-red {
          animation: pulse-red 2s infinite ease-in-out;
        }
      `}</style>

      {/* Admin Dashboard Modal */}
      <AnimatePresence>
        {showAdminModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-center justify-center p-5 bg-black/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0c0c0c] border border-gold/20 rounded-3xl p-8 w-full max-w-[600px] shadow-3xl"
            >
              <div className="flex justify-between items-center mb-8 border-b border-[#222] pb-6">
                <div className="flex items-center gap-3 text-gold">
                  <Settings size={24} />
                  <h3 className="font-orbitron font-bold text-white tracking-[0.2em] text-lg uppercase">Inventory Management</h3>
                </div>
                <button onClick={() => setShowAdminModal(false)} className="text-[#444] hover:text-white transition-colors"><X size={24} /></button>
              </div>

              <div className="space-y-4">
                {motorcycles.map(item => (
                  <div key={`admin-${item.id}`} className="bg-[#111] border border-[#222] p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-8 rounded-lg overflow-hidden relative border border-[#333]">
                        <Image src={item.img} alt={item.name} fill className="object-cover" />
                      </div>
                      <div className="text-xs font-bold uppercase tracking-widest">{item.name}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] text-[#444] font-bold uppercase tracking-widest">Current Stock</span>
                        <span className="text-sm font-orbitron font-bold text-gold">{globalStock[item.id] || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            const newStock = (globalStock[item.id] || 0) + 1;
                            await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
                          }}
                          className="bg-[#222] text-gold p-2 rounded-lg hover:bg-gold hover:text-black transition-all"
                        >
                          +1
                        </button>
                        <button 
                          onClick={async () => {
                            const newStock = Math.max(0, (globalStock[item.id] || 0) - 1);
                            await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
                          }}
                          className="bg-[#222] text-[#ff4444] p-2 rounded-lg hover:bg-[#ff4444] hover:text-white transition-all"
                        >
                          -1
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <p className="text-[10px] text-[#444] italic">Changes are propagated instantly to all connected nodes via Supabase Realtime.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
