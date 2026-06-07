import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SummaryCard from './components/SummaryCard';
import TransactionList from './components/TransactionList';
import Statistics from './components/Statistics';
import Settlements from './components/Settlements';
import EditTransactionModal from './components/EditTransactionModal';
import FinancialHealthWidget from './components/FinancialHealthWidget';
import DailyBalanceTracker from './components/DailyBalanceTracker';
import { MonthData, TransactionType, Transaction, FinancialProjection, DebtSettlement, DailyBalanceLog } from './types';
import { generateMonthData, getStorageKey } from './utils/financeUtils';
import { db, auth, isConfigured, onAuthStateChanged, signInAnonymously } from './services/firebaseConfig';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { FAMILY_ID } from './constants';
import { Target, Plus, ShoppingBag, User, Users, ArrowRight, Plane, Wallet, PiggyBank, Home as HomeIcon, Palmtree, Heart, Car, GraduationCap, MoreHorizontal, TrendingUp, ShoppingCart, FileWarning } from 'lucide-react';
import { formatCurrency } from './utils/financeUtils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  const jsonError = JSON.stringify(errInfo);
  console.error("Firestore Error: ", jsonError);
  // Do not throw as it crashes the entire React tree causing a white screen
  // instead, we just log and let the app continue in offline mode if possible
};

const App: React.FC = () => {
    // App State
    // Default to June 2026 as requested by the user
    const [currentMonth, setCurrentMonth] = useState(6);
    const [currentYear, setCurrentYear] = useState(2026);
    const [monthData, setMonthData] = useState<MonthData | null>(null);
    const [view, setView] = useState<'home' | 'transactions' | 'statistics' | 'settlements'>('home');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'online'>('offline');
    const [transactionListType, setTransactionListType] = useState<TransactionType>('expenses');
    const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');
    const [filter, setFilter] = useState<{ type: 'group' | 'none', value: string }>({ type: 'none', value: '' });

    const [showSecurityMessage, setShowSecurityMessage] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            setDeferredPrompt(null);
        });
    };

    // Edit Modal State
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [checkIn, setCheckIn] = useState<{ isDone: boolean; date: string | null }>({ isDone: false, date: null });
    // NEW: Centralized Bank Reserves Update from monthData
    const bankReserves = useMemo(() => {
        return monthData?.bankReserves || { santander: 0, inter: 0, sofisa: 0 };
    }, [monthData]);

    const handleUpdateReserves = (newReserves: { santander: number; inter: number; sofisa: number }) => {
        if (!monthData) return;
        saveData({ ...monthData, bankReserves: newReserves }, currentYear, currentMonth);
    };

    useEffect(() => {
        if (monthData?.checkIn) {
            setCheckIn(monthData.checkIn);
        } else {
            setCheckIn({ isDone: false, date: null });
        }
    }, [monthData]);

    const handleCheckIn = () => {
        if (!monthData) return;
        const date = new Date().toISOString();
        const newState = { isDone: true, date };
        setCheckIn(newState);
        saveData({ ...monthData, checkIn: newState }, currentYear, currentMonth);
    };

    const handleUpdateSettlements = (newSettlements: DebtSettlement[]) => {
        if (!monthData) return;
        saveData({ ...monthData, debtSettlements: newSettlements }, currentYear, currentMonth);
    };

    const handleUpdateDailyBalances = (newDailyBalances: DailyBalanceLog[]) => {
        if (!monthData) return;
        saveData({ ...monthData, dailyBalances: newDailyBalances }, currentYear, currentMonth);
    };

    // Force refresh to pull updated categories and grouping (v33)
    useEffect(() => {
        const forceUpdateV33 = localStorage.getItem('force_update_v33_mark_payments_28_apr');
        if (!forceUpdateV33) {
            localStorage.removeItem('financeData_2026_5');
            localStorage.setItem('force_update_v33_mark_payments_28_apr', 'true');
            window.location.reload();
        }
    }, []);

    // Derived Santander balance based on exact User Calculation (May 2026 Cycle)
    useEffect(() => {
        if (!monthData) return;
        
        let newReserves = { ...bankReserves };

        if (currentYear === 2026 && currentMonth === 5) {
            // Updated May 2026 reserves logic: User reports 22.28 in Santander.
            // Sofisa matches exactly what was moved in April (4351.00).
            newReserves = {
                santander: 22.28,
                inter: 0,
                sofisa: 4351.00
            };
        } else if (currentYear === 2026 && currentMonth === 6) {
            // June 2026 reserves: Default to R$ 1641.62 in Santander, R$ 307.98 in Banco Inter (poupança viagem) and R$ 0.00 in Sofisa as requested by user
            if (monthData.bankReserves && 
                monthData.bankReserves.santander !== 1730.00 && 
                monthData.bankReserves.santander !== 1641.62 && 
                monthData.bankReserves.inter !== 0 && 
                monthData.bankReserves.inter !== 248.31 &&
                monthData.bankReserves.inter !== 307.98 &&
                monthData.bankReserves.sofisa !== 4351.00 &&
                monthData.bankReserves.sofisa !== 0.00) return; // Prevent overwriting customized values or custom updates
            newReserves = {
                santander: 1641.62,
                inter: 307.98,
                sofisa: 0.00
            };
        } else if (currentYear === 2026 && currentMonth > 6) {
            // For future months (e.g. July 2026 and onwards): default Inter to 307.98 (poupança viagem) and Sofisa to 0.00 by default unless authorized
            if (monthData.bankReserves && 
                (monthData.bankReserves.inter === 248.31 || monthData.bankReserves.inter === 307.98) && 
                monthData.bankReserves.sofisa === 0.00) {
                if (monthData.bankReserves.inter === 248.31) {
                    newReserves = {
                        ...monthData.bankReserves,
                        inter: 307.98
                    };
                } else {
                    return; // already initialized, keep whatever Santander balance exists or has been edited
                }
            } else {
                newReserves = {
                    santander: monthData.bankReserves?.santander || 0.00,
                    inter: 307.98,
                    sofisa: 0.00
                };
            }
        } else {
            // Fallback: This is a complex derivation based on initial May salaries.
            // We usually only want to auto-derive if NO bankReserves exist yet.
            if (monthData.bankReserves) return; 

            const initialRevenue = 7643.53;
            const sofisaTransfer = 4351.00;
            const totalPaidExpenses = monthData.expenses.filter(e => e.paid && !e.skipped).reduce((sum, e) => sum + e.amount, 0);
            const totalPaidAvulsos = monthData.avulsosItems.filter(e => e.paid && !e.skipped).reduce((sum, e) => sum + e.amount, 0);
            const currentSantander = initialRevenue - sofisaTransfer - totalPaidExpenses - totalPaidAvulsos;
            
            newReserves = {
                santander: Math.max(0, Math.round(currentSantander * 100) / 100),
                inter: 0,
                sofisa: sofisaTransfer
            };
        }

        // Only update if different and we are NOT in an infinite loop
        if (JSON.stringify(newReserves) !== JSON.stringify(monthData.bankReserves)) {
             // We use a small delay to avoid fighting with other effects
             const timeout = setTimeout(() => {
                saveData({ ...monthData, bankReserves: newReserves }, currentYear, currentMonth);
             }, 100);
             return () => clearTimeout(timeout);
        }
    }, [monthData, currentYear, currentMonth]);

    // User request: Avulsos are now baked into defaults in financeUtils.ts

    // Automatic salary payment
    useEffect(() => {
        if (!monthData) return;
        
        const now = new Date();
        const payTimeLimit = new Date();
        payTimeLimit.setHours(7, 1, 0, 0);

        let updated = false;
        const newIncomes = monthData.incomes.map(item => {
            if (item.category === 'Salário' && !item.paid && item.dueDate) {
                const [y, m, d] = item.dueDate.split('-').map(Number);
                const dueDate = new Date(y, m - 1, d);
                
                // If today is or after due date and it's past 07:01 AM (or it's after the due date)
                if (now >= dueDate && (now.getDate() !== dueDate.getDate() || now >= payTimeLimit)) {
                    updated = true;
                    return { ...item, paid: true, paidAt: now.toISOString() };
                }
            }
            return item;
        });

        if (updated) {
            const newData = { ...monthData, incomes: newIncomes };
            saveData(newData, currentYear, currentMonth);
        }
    }, [monthData]);

    // Ref for accessing latest data in closures/listeners
    const monthDataRef = useRef<MonthData | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    useEffect(() => { monthDataRef.current = monthData; }, [monthData]);

    // Load Initial Data
    useEffect(() => {
        loadData(currentYear, currentMonth);
        if (isConfigured && auth) {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    setSyncStatus('online');
                    setupRealtimeListener(currentYear, currentMonth);
                } else {
                    signInAnonymously(auth).catch((e) => {
                        if (e.message && e.message.includes('identity-toolkit-api-has-not-been-used')) {
                            console.warn("Firebase Auth API not enabled. Running in Offline Mode.");
                        } else {
                            console.error("Auth Error", e);
                        }
                        setSyncStatus('offline');
                    });
                }
            });
        }

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    // NEW: Force sync on visibility change (when opening app from background) to ensure instant updates
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Trigger a re-read if needed, though onSnapshot handles most.
                // This ensures if the socket was paused, we wake it up.
                console.log("App foregrounded, ensuring sync...");
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);


    const ensureSystemIntegrity = (data: MonthData, year: number, month: number): MonthData => {
        // PRESERVE USER METADATA: if the user explicitly clicked "paid", don't let hardcoded tweaks override it
        const originalUserModifications = new Map();
        [...data.expenses, ...data.avulsosItems, ...data.incomes].forEach(item => {
            if (item.userModifiedPaid) {
                originalUserModifications.set(item.id, { paid: item.paid, paidAt: item.paidAt, userModifiedPaid: true });
            }
        });

        // Initialize debt settlements if missing
        if (!data.debtSettlements || data.debtSettlements.length === 0) {
            data.debtSettlements = [
                { id: 'set_nubank', description: 'Acordo Nubank (À Vista)', amount: 700, priority: 1, isPaid: false, notes: 'Pagamento via PIX' },
                { id: 'set_itau_marcelly', description: 'Acordo Itaú Marcelly (À Vista)', amount: 400, priority: 2, isPaid: false, notes: 'Pagamento via PIX' }
            ];
        }

        // Initialize daily physical balance tracker if missing
        if (!data.dailyBalances) {
            data.dailyBalances = [];
        }

        // Help user pre-populate requested days for May 2026 cycle
        if (year === 2026 && month === 5 && data.dailyBalances.length === 0) {
            data.dailyBalances = [
                { id: 'db_22_may', date: '2026-05-22', santander: 1250.00, inter: 100.00, sofisa: 4351.00, notes: 'Saldo palpável na data (Maio 22)' },
                { id: 'db_29_may', date: '2026-05-29', santander: 450.00, inter: 0.00, sofisa: 4351.00, notes: 'Modificações após pagamentos (Maio 29)' },
                { id: 'db_30_may', date: '2026-05-30', santander: 22.28, inter: 0.00, sofisa: 4351.00, notes: 'Hoje em conta: real e palpável' }
            ];
        }

        // Help user pre-populate requested days for June 2026 cycle
        if (year === 2026 && month === 6) {
            if (data.dailyBalances.length === 0) {
                data.dailyBalances = [
                    { id: 'db_01_june', date: '2026-06-01', santander: 1641.62, inter: 307.98, sofisa: 0.00, notes: 'Saldo atual em contas (Inter: poupança viagem, Sofisa: zerado)' }
                ];
            } else {
                data.dailyBalances = data.dailyBalances.map(db => {
                    if (db.id === 'db_01_june' && db.inter === 248.31) {
                        return { ...db, inter: 307.98 };
                    }
                    return db;
                });
            }
        }

        // User request (May 2026 Cycle): Absolute corrections
        if (year === 2026 && month === 5) {
            // 1. DELETE SPECIFIC REMOVALS REQUESTED
            data.expenses = data.expenses.filter(e => {
                const desc = e.description.toUpperCase();
                return !desc.includes("VENENO") && 
                       !desc.includes("DÍVIDA NA RUA") && 
                       !desc.includes("DIVIDA NA RUA") && 
                       !desc.includes("EMPRÉSTIMO JADY") &&
                       !desc.includes("JADY - EMPRÉSTIMO") &&
                       !desc.includes("PAGAMENTO MÁRCIA BRITO") &&
                       !desc.includes("PAGAMENTO MARCIA BRITO") &&
                       !(desc.includes("EMPRÉSTIMO COM LILI") && e.amount === 800);
            });

            // 2. CONFIGURE LOANS AS REQUESTED (R$ 0 and specific installments)
            const ensureLoan = (desc: string, current: number, total: number, group: string) => {
                const existing = data.expenses.find(e => e.description.toUpperCase().includes(desc.toUpperCase()));
                if (existing) {
                    data.expenses = data.expenses.map(e => e.description.toUpperCase().includes(desc.toUpperCase()) 
                        ? { ...e, amount: 0, installments: { current, total }, paid: false, paidAt: undefined, group } : e);
                } else {
                    data.expenses.push({
                        id: `loan_${desc.replace(/\s/g,'')}`,
                        description: desc,
                        amount: 0,
                        category: "Dívidas",
                        group: group,
                        paid: false,
                        dueDate: "2026-05-15",
                        installments: { current, total }
                    });
                }
            };
            ensureLoan("EMPRÉSTIMO COM MARCIA BISPO", 0, 4, "MARCIA BISPO");
            ensureLoan("EMPRÉSTIMO COM LILI", 2, 5, "LILI TORRES");

            // 3. MODIFY AND MOVE (Compras IAGO) - Removed as requested

            // 4. SPECIFIC UPDATES: Aluguel, Realized Payments, and Unpaid Items
            data.expenses = data.expenses.map(e => {
                const desc = e.description.toUpperCase();
                
                // Aluguel set to 1300 and Mark as Paid on May 4th
                if (desc === "ALUGUEL") {
                    return { ...e, amount: 1300.00, paid: true, paidAt: "2026-05-04T12:00:00Z" };
                }

                // Claros and Car Insurance to Unpaid (reset to ensure latest status)
                if ((desc.includes("CLARO") && !desc.includes("EMPRÉSTIMO")) || desc.includes("SEGURO DO CARRO")) {
                    // But if it was paid in Apr logic, keep it? No, user says "dar baixa no valor do aluguel"
                    // implies they are actively reporting May payments.
                    return { ...e, paid: false, paidAt: undefined };
                }

                // Iago: Removed manual override for May as requested

                // Lili Torres Travel Installments: Sum is 1178.97 (paid on May 4th)
                if (desc.includes("ESTADIA") || desc.includes("PASSAGENS AÉREAS SP X JOBURG")) {
                    if (e.group === 'LILI TORRES') {
                        return { ...e, paid: true, paidAt: "2026-05-04T12:00:00Z" };
                    }
                }

                // Mark specific realized payments (Subtract from Santander logic)
                if (desc.includes("CARTÃO DO ITAÚ DA MARCELLY") || desc.includes("CARTAO DO ITAU DA MARCELLY")) {
                    return { ...e, amount: 168.00, paid: true, paidAt: "2026-04-28T12:00:00Z" };
                }
                if (desc.includes("CARTÃO DO ITAÚ DO ANDRÉ") || desc.includes("CARTAO DO ITAU DO ANDRE")) {
                    return { ...e, amount: 116.00, paid: true, paidAt: "2026-04-28T12:00:00Z" };
                }
                if (desc.includes("INTERNET DA CASA")) {
                    return { ...e, amount: 125.76, paid: true, paidAt: "2026-04-28T12:00:00Z" };
                }

                // New specific payments requested on April 28th
                const isPaid28 = desc.includes("GUARDA ROUPAS") || 
                                 desc.includes("REFORMA DO SOFÁ") || 
                                 desc.includes("FACULDADE DA MARCELLY") || 
                                 (desc.includes("PASSAGENS AÉREAS") && e.group !== 'MARCIA BRITO') || // Exclude Marcia Brito's passagens
                                 desc.includes("PASSAGENS DE ONIBUS") || 
                                 desc.includes("MALA DO ANDRÉ") || 
                                 desc.includes("RENEGOCIAR CARREFOUR");
                
                if (isPaid28) {
                    return { ...e, paid: true, paidAt: "2026-04-28T12:00:00Z" };
                }

                return e;
            });

            // 5. Marcia brito's specific custom overrides for May 2026:
            // "mao de obra do davi", "kr autopeças", "filhão autopeças", "cabesom", and "remédio" remain unpaid.
            // All other items for Márcia Brito are marked as paid.
            data.expenses = data.expenses.map(e => {
                if (e.group === 'MARCIA BRITO') {
                    const desc = e.description.toUpperCase();
                    const isUnpaidItem = desc.includes("MÃO DE OBRA") || 
                                         desc.includes("MAO DE OBRA") || 
                                         desc.includes("KR AUTO") || 
                                         desc.includes("FILHÃO AUTO") || 
                                         desc.includes("FILHAO AUTO") || 
                                         desc.includes("CABESOM") || 
                                         (desc.includes("REMÉDIO") && desc.includes("MARCIA"));
                    
                    if (isUnpaidItem) {
                        return { ...e, paid: false, paidAt: undefined };
                    } else {
                        return { ...e, paid: true, paidAt: "2026-05-12T12:00:00Z" };
                    }
                }
                return e;
            });

            // Ensure Realized helper items exist
            const realizeItem = (desc: string, amount: number, group: string, cat: string) => {
                const existing = data.expenses.find(e => e.description.toUpperCase().includes(desc.toUpperCase()));
                if (existing) {
                    data.expenses = data.expenses.map(e => e.description.toUpperCase().includes(desc.toUpperCase()) ? { ...e, amount, paid: true, paidAt: "2026-04-30T12:00:00Z" } : e);
                } else {
                    data.expenses.push({
                        id: `real_${desc.replace(/\s/g,'')}`,
                        description: desc,
                        amount: amount,
                        category: cat,
                        group: group,
                        paid: true,
                        dueDate: "2026-04-30",
                        paidAt: "2026-04-30T12:00:00Z"
                    });
                }
            };
            realizeItem("PAGAMENTO DE PERFUME", 100.00, "DÍVIDAS", "Dívidas");
            
            // Set Avulsos specifically as paid for this cycle and ensure they exist
            const essentialAvulsos = [
                { id: `avulso_combustivel_may`, desc: "COMBUSTÍVEL (30/04)", amount: 50.00, cat: "Transporte", date: "2026-04-30" },
                { id: `avulso_mercado_may`, desc: "MERCADO (29/04)", amount: 187.28, cat: "Alimentação", date: "2026-04-29" },
                { id: `avulso_agua_may`, desc: "COMPRA DA ÁGUA (29/04)", amount: 10.00, cat: "Alimentação", date: "2026-04-29" }
            ];

            essentialAvulsos.forEach(ea => {
                const exists = data.avulsosItems.find(a => a.description.toUpperCase().includes(ea.desc.toUpperCase()));
                if (!exists) {
                    data.avulsosItems.push({
                        id: ea.id,
                        description: ea.desc,
                        amount: ea.amount,
                        category: ea.cat,
                        paid: true,
                        dueDate: ea.date,
                        date: ea.date,
                        paidAt: "2026-04-30T12:00:00Z"
                    });
                }
            });

            data.avulsosItems = data.avulsosItems.map(a => {
                const desc = a.description.toUpperCase();
                if (desc.includes("COMBUSTÍVEL") || desc.includes("ABASTECIMENTO") || desc.includes("MERCADO") || desc.includes("ÁGUA")) {
                    return { ...a, paid: true, paidAt: "2026-04-30T12:00:00Z" };
                }
                return a;
            });
        }

        // User request (June 2026 Cycle): Incomes updates
        if (year === 2026 && month === 6) {
            // Under June 2026, we have specific incomes instead of the template ones:
            // 1. Rescisão (Prefeitura de Maricá - André): 3179.98 on May 22nd
            // 2. Décimo Terceiro (Estado - André): 2433.89 on May 29th
            // 3. Salário de Maio (Estado - André): 2805.96 on May 30th
            // 4. Salário Normal (Marcelly): 3436.22 on May 22nd
            // All of these entered to pay June accounts.
            
            data.incomes = [
                {
                    id: 'inc_rescisao_andre_jun26',
                    description: 'RESCISÃO MARICÁ - ANDRÉ',
                    amount: 3179.98,
                    paid: true,
                    date: '2026-05-22',
                    dueDate: '2026-05-22',
                    category: 'Salário',
                    paidAt: '2026-05-22T12:00:00Z'
                },
                {
                    id: 'inc_m_2026_6',
                    description: 'SALARIO MARCELLY',
                    amount: 3436.22,
                    paid: true,
                    date: '2026-05-22',
                    dueDate: '2026-05-22',
                    category: 'Salário',
                    paidAt: '2026-05-22T12:00:00Z'
                },
                {
                    id: 'inc_13_estado_andre_jun26',
                    description: '13º SALÁRIO (ESTADO) - ANDRÉ',
                    amount: 2433.89,
                    paid: true,
                    date: '2026-05-29',
                    dueDate: '2026-05-29',
                    category: 'Salário',
                    paidAt: '2026-05-29T12:00:00Z'
                },
                {
                    id: 'inc_sal_estado_andre_jun26',
                    description: 'SALÁRIO MAIO (ESTADO) - ANDRÉ',
                    amount: 2805.96,
                    paid: true,
                    date: '2026-05-30',
                    dueDate: '2026-05-30',
                    category: 'Salário',
                    paidAt: '2026-05-30T12:00:00Z'
                },
                {
                    id: 'inc_mum_m_2026_6',
                    description: 'MUMBUCA MARCELLY',
                    amount: 598.00,
                    paid: false,
                    date: '2026-06-10',
                    dueDate: '2026-06-10',
                    category: 'Mumbuca'
                }
            ];
        }

        // User request starting June 2026 (June and forward)
        if (year === 2026 && month >= 6) {

            // André's salary changes to approximately 3100.00 starting July 2026 (month >= 7)
            if (month >= 7) {
                // If July 2026, customize dates and names explicitly as requested
                if (month === 7) {
                    data.incomes = data.incomes.map(i => {
                        const desc = i.description.toUpperCase();
                        if (desc === "SALARIO ANDRE" || desc === "SALÁRIO ANDRÉ" || desc === "SALÁRIO DO ANDRÉ" || desc === "SALARIO DO ANDRE" || desc.includes("SALÁRIO ANDRÉ") || desc.includes("SALARIO ANDRE")) {
                            return { 
                                ...i, 
                                description: "SALÁRIO ANDRÉ (Recebimento: 01/07 - Estado)",
                                amount: 3100.00,
                                date: "2026-07-01",
                                dueDate: "2026-07-01"
                            };
                        }
                        if (desc === "SALARIO MARCELLY" || desc === "SALÁRIO MARCELLY" || desc === "SALÁRIO DA MARCELLY" || desc === "SALARIO DA MARCELLY" || desc.includes("SALÁRIO MARCELLY") || desc.includes("SALARIO MARCELLY")) {
                            return {
                                ...i,
                                description: "SALÁRIO MARCELLY (Recebimento: 26/06)",
                                amount: 3436.22,
                                date: "2026-06-26",
                                dueDate: "2026-06-26"
                            };
                        }
                        return i;
                    });
                } else {
                    data.incomes = data.incomes.map(i => {
                        const desc = i.description.toUpperCase();
                        if (desc === "SALARIO ANDRE" || desc === "SALÁRIO ANDRÉ" || desc === "SALÁRIO DO ANDRÉ" || desc === "SALARIO DO ANDRE") {
                            return { ...i, amount: 3100.00 };
                        }
                        return i;
                    });
                }

                // André's 1st installment of 13º salary is removed for July 2026 (month === 7)
                if (month === 7) {
                    data.incomes = data.incomes.filter(i => {
                        const desc = i.description.toUpperCase();
                        return !desc.includes("1ª PARCELA 13º ANDRÉ") && !desc.includes("1A PARCELA 13O ANDRE") && !desc.includes("13º ANDRÉ") && i.id !== "inc_13_1_a_2026";
                    });

                    // Add Income Tax Refund for André and Marcelly in July 2026 (R$ 343.49 each)
                    const hasRefundAndre = data.incomes.some(i => i.id === "inc_ir_a_2026" || i.description.toUpperCase().includes("RESTITUIÇÃO IR ANDRÉ") || i.description.toUpperCase().includes("RESTITUICAO IR ANDRE"));
                    const hasRefundMarcelly = data.incomes.some(i => i.id === "inc_ir_m_2026" || i.description.toUpperCase().includes("RESTITUIÇÃO IR MARCELLY") || i.description.toUpperCase().includes("RESTITUICAO IR MARCELLY"));
                    
                    if (!hasRefundAndre) {
                        data.incomes.push({
                            id: "inc_ir_a_2026",
                            description: "RESTITUIÇÃO IR ANDRÉ",
                            amount: 343.49,
                            paid: false,
                            date: "2026-07-15",
                            dueDate: "2026-07-15",
                            category: "Outros"
                        });
                    }
                    if (!hasRefundMarcelly) {
                        data.incomes.push({
                            id: "inc_ir_m_2026",
                            description: "RESTITUIÇÃO IR MARCELLY",
                            amount: 343.49,
                            paid: false,
                            date: "2026-07-15",
                            dueDate: "2026-07-15",
                            category: "Outros"
                        });
                    }
                }
            }

            // Filter out Seguro do Carro for June 2026 specifically (paying late with July funds)
            if (month === 6) {
                data.expenses = data.expenses.filter(e => e.description.toUpperCase() !== "SEGURO DO CARRO");
            }

            // Cartão do Itaú da Marcelly set to 0.00 (zerado) for June 2026 explicitly, and preserved for next months
            if (month === 6) {
                data.expenses = data.expenses.map(e => {
                    const desc = e.description.toUpperCase();
                    if (desc === "CARTÃO DO ITAÚ DA MARCELLY" || desc === "CARTAO DO ITAU DA MARCELLY") {
                        return { ...e, amount: 0.00 };
                    }
                    return e;
                });
            }

            // Pausing "Empréstimo com Márcia Bispo" for June 2026, resuming July 2026 as installment 3/4
            if (month === 6) {
                data.expenses = data.expenses.filter(e => e.description.toUpperCase() !== "EMPRÉSTIMO COM MARCIA BISPO");
            } else if (month > 6) {
                // For July 2026 and later, ensure the installment is correctly shifted
                data.expenses = data.expenses.map(e => {
                    if (e.description.toUpperCase() === "EMPRÉSTIMO COM MARCIA BISPO") {
                        const installmentAmount = 100.00; // 400.00 / 4
                        // Calculate shifted installment info where July (month 7) starting with May (5) reference is installment 3
                        const diff = month - 5;
                        const current = diff + 1;
                        if (current >= 1 && current <= 4) {
                            return {
                                ...e,
                                amount: installmentAmount,
                                installments: { current, total: 4 }
                            };
                        }
                    }
                    return e;
                });
            }

            // Alinhamento do carro: parcela 1 starts in July, parcela 2 is in August. Force removing from June if present.
            if (month === 6) {
                data.expenses = data.expenses.filter(e => e.description.toUpperCase() !== "ALINHAMENTO DO CARRO");
            } else if (month === 7 || month === 8) {
                const currentInst = month === 7 ? 1 : 2;
                // Ensure it exists with correct installment
                const existingIndex = data.expenses.findIndex(e => e.description.toUpperCase() === "ALINHAMENTO DO CARRO");
                if (existingIndex === -1) {
                    data.expenses.push({
                        id: `fin_ALINHAMENTODOCARRO_${currentInst}`,
                        description: "ALINHAMENTO DO CARRO",
                        amount: 165.00, // 330.00 / 2
                        category: "Transporte",
                        paid: false,
                        dueDate: `2026-0${month}-12`,
                        installments: { current: currentInst, total: 2 },
                        group: 'MARCIA BRITO'
                    });
                } else {
                    data.expenses = data.expenses.map(e => {
                        if (e.description.toUpperCase() === "ALINHAMENTO DO CARRO") {
                            return {
                                ...e,
                                amount: 165.00,
                                installments: { current: currentInst, total: 2 }
                            };
                        }
                        return e;
                    });
                }
            }

            // 2. Cartão do Itaú do André is always 100 reais
            data.expenses = data.expenses.map(e => {
                const desc = e.description.toUpperCase();
                if (desc.includes("CARTÃO DO ITAÚ DO ANDRÉ") || desc.includes("CARTAO DO ITAU DO ANDRE")) {
                    return { ...e, amount: 100.00 };
                }
                return e;
            });

            // 3. Delete "CONTA DA CLARO ANDRÉ" completely
            data.expenses = data.expenses.filter(e => {
                const desc = e.description.toUpperCase();
                return !(desc.includes("CLARO") && (desc.includes("ANDRÉ") || desc.includes("ANDRE")));
            });

            // 4. Delete "CONTA DA VIVO DO ANDRÉ" and "CONTA DA VIVO DA MARCELLY" completely starting June
            data.expenses = data.expenses.filter(e => {
                const desc = e.description.toUpperCase();
                const isVivoAndre = desc.includes("VIVO") && (desc.includes("ANDRÉ") || desc.includes("ANDRE"));
                const isVivoMarcelly = desc.includes("VIVO") && desc.includes("MARCELLY");
                return !(isVivoAndre || isVivoMarcelly);
            });

            // 5. Adjust "REMÉDIOS DO ANDRÉ" to 170.00 and mark as paid (bought last Wednesday, May 27, 2026) ONLY in June 2026. Keep unpaid in future months.
            data.expenses = data.expenses.map(e => {
                const desc = e.description.toUpperCase();
                if (desc.includes("REMÉDIOS DO ANDRÉ") || desc.includes("REMEDIOS DO ANDRE")) {
                    if (month === 6) {
                        return { ...e, amount: 170.00, paid: true, paidAt: '2026-05-27' };
                    } else if (month >= 7) {
                        return { ...e, amount: 170.00, paid: false, paidAt: undefined };
                    }
                }
                return e;
            });

            // 6. Iago single transaction requested by user
            data.expenses = data.expenses.filter(e => {
                const isIago = e.category === 'Iago' || e.group === 'IAGO' || e.description.toUpperCase().includes('IAGO');
                if (isIago && e.description !== 'CARTÃO DO IAGO') return false; 
                return true;
            });
            data.avulsosItems = data.avulsosItems.filter(e => {
                const isIago = e.category === 'Iago' || e.group === 'IAGO' || e.description.toUpperCase().includes('IAGO');
                if (isIago && e.description !== 'CARTÃO DO IAGO') return false; 
                return true;
            });

            // Ensure our new CARTÃO DO IAGO is correctly there
            const hasCartaoIago = data.expenses.some(e => e.description === 'CARTÃO DO IAGO');
            const targetIagoAmount = (year === 2026 && month === 7) ? 430.00 : 1819.22;
            if (!hasCartaoIago) {
                data.expenses.push({
                    id: `exp_cartao_iago_${year}_${month}`,
                    description: "CARTÃO DO IAGO",
                    amount: targetIagoAmount,
                    category: "Iago",
                    paid: false,
                    dueDate: `${year}-${month.toString().padStart(2,'0')}-07`,
                    group: 'IAGO'
                });
            } else {
                // Ensure it has the correct amount (in case user had a different amount saved locally)
                data.expenses = data.expenses.map(e => e.description === 'CARTÃO DO IAGO' ? { ...e, amount: targetIagoAmount, dueDate: `${year}-${month.toString().padStart(2,'0')}-07` } : e);
            }

            // Ensure EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO is correctly present for months 6, 7, 8, 9 in 2026
            if (year === 2026 && month >= 6 && month <= 9) {
                const currentInst = month - 5; // June is 1, July is 2, Aug is 3, Sept is 4
                const hasLoanContas = data.expenses.some(e => {
                    const d = e.description.toUpperCase();
                    return d.includes('EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO') || d.includes('EMPRESTIMO PARA PAGAR AS CONTAS DE JUNHO');
                });
                if (!hasLoanContas) {
                    data.expenses.push({
                        id: `fin_EMPRÉSTIMOPARAPAGARASCONTASDEJUNHO_${currentInst}`,
                        description: "EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO",
                        amount: 486.00, // 1944.00 / 4
                        category: "Dívidas",
                        paid: false,
                        dueDate: `2026-0${month}-20`,
                        installments: { current: currentInst, total: 4 },
                        group: 'MARCIA BRITO'
                    });
                } else {
                    // Update to ensure correct installment, amount, group, etc.
                    data.expenses = data.expenses.map(e => {
                        const d = e.description.toUpperCase();
                        if (d.includes('EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO') || d.includes('EMPRESTIMO PARA PAGAR AS CONTAS DE JUNHO')) {
                            return {
                                ...e,
                                amount: 486.00,
                                category: "Dívidas",
                                dueDate: `2026-0${month}-20`,
                                installments: { current: currentInst, total: 4 },
                                group: 'MARCIA BRITO'
                            };
                        }
                        return e;
                    });
                }
            }

            // 7. Markings as Paid based on user request (LILI, ITAÚ DO ANDRÉ, MARCIA BRITO, CARTÃO DO IAGO)
            const markAsPaidLogic = (e: Transaction) => {
                const desc = e.description.toUpperCase();
                
                // Aluguel
                if (desc === 'ALUGUEL') {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                // Internet da casa
                if (desc === 'INTERNET DA CASA') {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                // Itaú do André
                if (desc.includes('CARTÃO DO ITAÚ DO ANDRÉ') || desc.includes('CARTAO DO ITAU DO ANDRE')) {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                // Todas as contas com LILI
                if (e.group === 'LILI TORRES' || desc.includes('LILI')) {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                // Cartão do Iago
                if (desc === 'CARTÃO DO IAGO' || desc === 'CARTAO DO IAGO') {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                // Marcia Brito (exceto Alinhamento do carro, exceto Marcia Bispo, exceto empréstimo contas de junho)
                const isMarciaBrito = e.group === 'MARCIA BRITO' || (desc.includes('MARCIA') && !desc.includes('BISPO') && e.group !== 'MARCIA BISPO');
                if (isMarciaBrito && desc !== 'ALINHAMENTO DO CARRO' && !desc.includes('EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO') && !desc.includes('EMPRESTIMO PARA PAGAR AS CONTAS DE JUNHO')) {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                return e;
            };
            if (month === 6) {
                data.expenses = data.expenses.map(markAsPaidLogic);
                data.avulsosItems = data.avulsosItems.map(markAsPaidLogic);
            }
        }

        // Apply preserved user states
        const applyPreserved = (t: Transaction) => {
            const desc = t.description.toUpperCase();
            const isMarciaBrito = t.group === 'MARCIA BRITO' || (desc.includes('MARCIA') && !desc.includes('BISPO') && t.group !== 'MARCIA BISPO');
            const isLili = t.group === 'LILI TORRES' || desc.includes('LILI');
            const isItauAndre = desc.includes('CARTÃO DO ITAÚ DO ANDRÉ') || desc.includes('CARTAO DO ITAU DO ANDRE');
            const isAluguel = desc === 'ALUGUEL';
            const isInternetCasa = desc === 'INTERNET DA CASA';
            const isIagoCard = desc === 'CARTÃO DO IAGO' || desc === 'CARTAO DO IAGO';
            const isLoanContasJunho = desc.includes('EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO') || desc.includes('EMPRESTIMO PARA PAGAR AS CONTAS DE JUNHO');

            if (year === 2026 && month === 6 && 
               (((isMarciaBrito && desc !== 'ALINHAMENTO DO CARRO' && !isLoanContasJunho)) || isLili || isItauAndre || isAluguel || isInternetCasa || isIagoCard)) {
                return t; // Keep the programmatic override for these accounts only in June 2026
            }
            
            const orig = originalUserModifications.get(t.id);
            if (orig) {
                return { ...t, paid: orig.paid, paidAt: orig.paidAt, userModifiedPaid: true };
            }
            return t;
        };

        data.expenses = data.expenses.map(applyPreserved);
        data.avulsosItems = data.avulsosItems.map(applyPreserved);
        data.incomes = data.incomes.map(applyPreserved);

        // For July 2026 and subsequent months, ensure all debts (expenses and avulsos) are unmarked/unpaid by default
        if ((year === 2026 && month >= 7) || year > 2026) {
            data.expenses = data.expenses.map(e => {
                if (e.userModifiedPaid) return e;
                return { ...e, paid: false, paidAt: undefined };
            });
            data.avulsosItems = data.avulsosItems.map(a => {
                if (a.userModifiedPaid) return a;
                return { ...a, paid: false, paidAt: undefined };
            });
        }

        // Sort expenses and avulsosItems alphabetically by description (QQ Divida dentro de cada categoria)
        data.expenses = [...data.expenses].sort((a, b) => 
            a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' })
        );
        data.avulsosItems = [...data.avulsosItems].sort((a, b) => 
            a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' })
        );

        return data;
    };

    const loadData = async (year: number, month: number) => {
        try {
            const key = getStorageKey(year, month);
            const local = localStorage.getItem(key);
            
            if (local) {
                try {
                    const parsed = JSON.parse(local);
                    setMonthData(ensureSystemIntegrity(parsed, year, month));
                } catch (e) {
                    console.error("Failed to parse local data", e);
                    const newData = ensureSystemIntegrity(generateMonthData(year, month), year, month);
                    setMonthData(newData);
                }
            } else {
                const newData = ensureSystemIntegrity(generateMonthData(year, month), year, month);
                setMonthData(newData);
            }
        } catch (error) {
            console.error("Critical error in loadData", error);
            // Fallback to minimal data to avoid white screen
            setMonthData(generateMonthData(year, month));
        }
    };

    const setupRealtimeListener = (year: number, month: number) => {
        if (!isConfigured) return;
        
        // Cleanup previous listener
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }

        const docRef = doc(db, 'families', FAMILY_ID, 'months', `${year}_${month}`);
        const path = `families/${FAMILY_ID}/months/${year}_${month}`;
        
        const unsubscribe = onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
                let cloudData = snapshot.data() as MonthData;
                const localData = monthDataRef.current;

                cloudData = ensureSystemIntegrity(cloudData, year, month);

                // Only update if cloud data is newer
                if (!localData || cloudData.updatedAt > localData.updatedAt) {
                    setMonthData(cloudData);
                    localStorage.setItem(getStorageKey(year, month), JSON.stringify(cloudData));
                } else if (localData && localData.updatedAt > cloudData.updatedAt) {
                    // Local data is newer than Firestore! Push local to cloud!
                    setDoc(docRef, localData)
                        .then(() => setSyncStatus('online'))
                        .catch(e => handleFirestoreError(e, OperationType.WRITE, path));
                }
            } else {
                // Documents does not exist in Firestore yet!
                // If we have local data, push it. Otherwise generate default and push.
                const localData = monthDataRef.current;
                if (localData) {
                    setDoc(docRef, localData)
                        .then(() => setSyncStatus('online'))
                        .catch(e => handleFirestoreError(e, OperationType.WRITE, path));
                } else {
                    const newData = ensureSystemIntegrity(generateMonthData(year, month), year, month);
                    setMonthData(newData);
                    localStorage.setItem(getStorageKey(year, month), JSON.stringify(newData));
                    setDoc(docRef, newData)
                        .then(() => setSyncStatus('online'))
                        .catch(e => handleFirestoreError(e, OperationType.WRITE, path));
                }
            }
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, path);
        });

        unsubscribeRef.current = unsubscribe;
        return unsubscribe;
    };

    const saveData = async (data: MonthData | null, year: number, month: number) => {
        if (!data) return;
        
        const ensuredData = ensureSystemIntegrity(data, year, month);
        const updatedData = { ...ensuredData, updatedAt: Date.now() };
        setMonthData(updatedData);
        localStorage.setItem(getStorageKey(year, month), JSON.stringify(updatedData));

        if (isConfigured && auth?.currentUser) {
            setSyncStatus('syncing');
            const path = `families/${FAMILY_ID}/months/${year}_${month}`;
            try {
                const docRef = doc(db, 'families', FAMILY_ID, 'months', `${year}_${month}`);
                await setDoc(docRef, updatedData);
                setSyncStatus('online');
            } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, path);
            }
        }
    };

    const handleMonthChange = (diff: number) => {
        let newMonth = currentMonth + diff;
        let newYear = currentYear;
        
        if (newMonth > 12) {
            newMonth = 1;
            newYear++;
        } else if (newMonth < 1) {
            newMonth = 12;
            newYear--;
        }
        
        setCurrentYear(newYear);
        setCurrentMonth(newMonth);
        loadData(newYear, newMonth);
        if (isConfigured && auth?.currentUser) {
            setupRealtimeListener(newYear, newMonth);
        }
    };

    const handleTogglePaid = (id: string, paid: boolean, type: TransactionType) => {
        if (!monthData) return;
        const newData = { ...monthData };
        
        newData[type] = newData[type].map(t => {
            if (t.id === id) {
                return { ...t, paid, paidAt: paid ? new Date().toISOString() : undefined, userModifiedPaid: true };
            }
            return t;
        });
        
        saveData(newData, currentYear, currentMonth);
    };

    const handleToggleGroupPaid = (items: Transaction[]) => {
        if (!monthData) return;
        const allPaid = items.every(i => i.paid);
        const newData = { ...monthData };
        const itemIds = new Set(items.map(i => i.id));
        
        newData.expenses = newData.expenses.map(e => itemIds.has(e.id) ? { ...e, paid: !allPaid, paidAt: !allPaid ? new Date().toISOString() : undefined, userModifiedPaid: true } : e);
        saveData(newData, currentYear, currentMonth);
    };

    const handleEditTransaction = (t: Transaction) => {
        setEditingTransaction(t);
        setIsEditModalOpen(true);
    };

    const handleSaveTransaction = (updated: Transaction, type?: TransactionType) => {
        if (!monthData) return;
        const newData = { ...monthData };
        
        let found = false;
        const targetType = type || transactionListType;
        
        // Ensure manual edits mark userModifiedPaid if they explicitly deal with payments
        const finalUpdated = { ...updated, userModifiedPaid: true };

        // Helper to check and update
        const tryUpdate = (listName: TransactionType) => {
            const index = newData[listName].findIndex(t => t.id === finalUpdated.id);
            if (index !== -1) {
                newData[listName][index] = finalUpdated;
                return true;
            }
            return false;
        };

        if (tryUpdate('incomes')) found = true;
        else if (tryUpdate('expenses')) found = true;
        else if (tryUpdate('avulsosItems')) found = true;

        if (!found) {
            // New transaction
            newData[targetType] = [finalUpdated, ...newData[targetType]];
        }
        
        saveData(newData, currentYear, currentMonth);
        setIsEditModalOpen(false);
    };

    const handleAddNewTransaction = () => {
        const newT: Transaction = {
            id: `manual_${Date.now()}`,
            description: 'Nova Transação',
            amount: 0,
            category: 'Outros',
            paid: false,
            dueDate: `${currentYear}-${currentMonth.toString().padStart(2,'0')}-15`,
            group: transactionListType === 'expenses' ? 'Despesas Fixas' : undefined
        };
        handleEditTransaction(newT);
    };

    const filteredTransactions = useMemo(() => {
        if (!monthData) return [];
        let list = [...monthData[transactionListType]];
        if (transactionListType === 'expenses' || transactionListType === 'avulsosItems') {
            list.sort((a, b) => a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' }));
        }
        if (filter.type === 'group') {
            list = list.filter(t => t.group === filter.value);
        } else if (filter.type === 'category') {
            list = list.filter(t => t.category === filter.value);
        }
        return list;
    }, [monthData, transactionListType, filter]);

    const handleFilter = (type: 'group' | 'category' | 'none', value: string) => {
        setFilter({ type, value });
        setView('transactions');
        setTransactionListType('expenses');
    };

    // Stats Calculation
    const stats = useMemo(() => {
        if (!monthData) return { 
            salary: { total: 0, paid: 0 }, 
            combined: { total: 0, paid: 0 }, 
            realExpenses: { total: 0, paid: 0, unpaid: 0 },
            surplusRaw: 0
        };

        const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

        const isExcluded = (t: Transaction) => {
            if (t.skipped) return true;
            if (!t.isSuspended) return false;
            if (!t.suspendedUntil) return true; // Suspended indefinitely
            return currentMonthStr < t.suspendedUntil;
        };

        const salary = monthData.incomes.filter(i => i.category === 'Salário');
        const combined = monthData.incomes;
        
        // Filter out suspended transactions from totals
        const realExpenses = [
            ...monthData.expenses.filter(e => !isExcluded(e)),
            ...monthData.avulsosItems.filter(e => !isExcluded(e))
        ];

        const sum = (arr: Transaction[]) => arr.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const sumPaid = (arr: Transaction[]) => arr.filter(t => t.paid).reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const sumUnpaid = (arr: Transaction[]) => arr.filter(t => !t.paid).reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const surplusRaw = sum(combined) - sum(realExpenses);

        return {
            salary: { total: sum(salary), paid: sumPaid(salary) },
            combined: { total: sum(combined), paid: sumPaid(combined) },
            realExpenses: { total: sum(realExpenses), paid: sumPaid(realExpenses), unpaid: sumUnpaid(realExpenses) },
            surplusRaw
        };
    }, [monthData, currentYear, currentMonth]);

    const balance = (stats.combined.paid) - stats.realExpenses.paid;

    const latestDailyBalance = useMemo(() => {
        if (!monthData || !monthData.dailyBalances || monthData.dailyBalances.length === 0) return 0;
        const sorted = [...monthData.dailyBalances].sort((a, b) => b.date.localeCompare(a.date));
        const latest = sorted[0];
        return latest.santander + latest.inter + latest.sofisa;
    }, [monthData]);

    const sobraReal = useMemo(() => {
        return latestDailyBalance - stats.realExpenses.unpaid;
    }, [latestDailyBalance, stats.realExpenses.unpaid]);

    // Group Debts by Person
    const groupedDebts = useMemo(() => {
        if (!monthData) return [];
        const groups: Record<string, { name: string, total: number, paidAmount: number, items: Transaction[] }> = {};
        
        // Include both expenses and avulsosItems in the grouping
        const allItems = [...monthData.expenses, ...monthData.avulsosItems].sort((a, b) => 
            a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' })
        );
        
        allItems.forEach(e => {
            const groupNormal = e.group ? e.group.toUpperCase() : '';
            const excludedGroups = ['MORADIA', 'DESPESAS FIXAS', 'DESPESAS VARIÁVEIS', 'DESPESAS VARIAVEIS'];
            
            if (groupNormal && !excludedGroups.includes(groupNormal) && !e.isDistribution) {
                const name = groupNormal;
                if (!groups[name]) groups[name] = { name, total: 0, paidAmount: 0, items: [] };
                groups[name].total += e.amount;
                if (e.paid) groups[name].paidAmount += e.amount;
                groups[name].items.push(e);
            }
        });

        return Object.values(groups).sort((a, b) => b.total - a.total);
    }, [monthData]);

    const getDebtColor = (name: string) => {
        if (name.includes('LILI')) return 'from-teal-400 to-emerald-500';
        if (name.includes('MARCIA')) return 'from-emerald-500 to-teal-600';
        if (name.includes('JADY')) return 'from-green-400 to-emerald-500';
        if (name.includes('CLAUDIO')) return 'from-emerald-600 to-teal-700';
        if (name.includes('REBECCA')) return 'from-teal-500 to-emerald-600';
        if (name.includes('IAGO')) return 'from-emerald-400 to-teal-500';
        if (name.includes('DÍVIDAS NA RUA') || name.includes('DIVIDAS NA RUA')) return 'from-rose-400 to-orange-500';
        return 'from-emerald-700 to-teal-800';
    };

    const sidebarAccounts = monthData?.bankAccounts || [];

    if (!monthData) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-black text-slate-400 animate-pulse">Carregando Finanças...</div>;

    const getTabStyle = (type: TransactionType) => {
        if (transactionListType !== type) return 'text-slate-400 border-transparent';
        switch(type) {
            case 'incomes': return 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm';
            case 'expenses': return 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm';
            case 'avulsosItems': return 'bg-amber-50 text-amber-600 border-amber-100 shadow-sm';
            default: return 'bg-teal-50 text-teal-600';
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#f0fdf4] text-slate-900 font-sans overflow-hidden">
            {/* Bottom Navigation - Fixed and styled to match screenshot */}
            <nav className="fixed bottom-0 left-0 right-0 h-16 lg:h-20 bg-white/95 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around px-2 lg:px-8 z-[100] shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
                <button 
                    onClick={() => { setView('home'); setActiveTab('overview'); }}
                    className={`flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 w-24 lg:w-auto h-12 lg:h-auto rounded-xl transition-all font-black ${view === 'home' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                    <HomeIcon size={18} className="lg:w-5 lg:h-5" />
                    <span className="text-[10px] lg:text-sm uppercase tracking-tighter">Visão</span>
                </button>
                <button 
                    onClick={() => { setView('transactions'); }}
                    className={`flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 w-24 lg:w-auto h-12 lg:h-auto rounded-xl transition-all font-black ${view === 'transactions' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                    <ShoppingBag size={18} className="lg:w-5 lg:h-5" />
                    <span className="text-[10px] lg:text-sm uppercase tracking-tighter">Extrato</span>
                </button>
                <button 
                    onClick={() => { setView('statistics'); }}
                    className={`flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 w-24 lg:w-auto h-12 lg:h-auto rounded-xl transition-all font-black ${view === 'statistics' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                    <TrendingUp size={18} className="lg:w-5 lg:h-5" />
                    <span className="text-[10px] lg:text-sm uppercase tracking-tighter">Relatórios</span>
                </button>
            </nav>

            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-100/30 blur-[120px] rounded-full -z-10"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/30 blur-[100px] rounded-full -z-10"></div>

                <Header 
                    month={currentMonth} 
                    year={currentYear} 
                    balance={checkIn.isDone ? balance : 0}
                    bankReserves={bankReserves}
                    setBankReserves={handleUpdateReserves}
                    checkInDate={checkIn.date}
                    onMonthChange={handleMonthChange}
                    onSync={() => saveData(monthData, currentYear, currentMonth)}
                    syncStatus={syncStatus}
                />

                <Sidebar 
                    isOpen={sidebarOpen} 
                    onClose={() => setSidebarOpen(false)} 
                    accounts={sidebarAccounts} 
                    syncStatus={syncStatus}
                    onSync={() => saveData(monthData, currentYear, currentMonth)}
                    currentView={view}
                    onNavigate={setView}
                    onInstall={handleInstallClick}
                    canInstall={!!deferredPrompt}
                />

                <EditTransactionModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    transaction={editingTransaction}
                    onSave={handleSaveTransaction}
                />

                {showSecurityMessage && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
                        <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center gap-6">
                            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center shadow-inner">
                                <FileWarning size={40} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Segurança de Dados</h3>
                                <p className="text-base font-black text-slate-500 leading-relaxed">
                                    Por diretriz de segurança inabalável, a exclusão de contas e transações foi desativada. Seus dados estão protegidos e permanecerão no backup do sistema e na nuvem para sempre.
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowSecurityMessage(false)}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                )}

                <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-20 scroll-smooth relative">
                    <AnimatePresence mode="wait">
                        {view === 'home' && (
                            <motion.div 
                                key="home"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.5 }}
                                className="w-full flex flex-col gap-8"
                            >
                                
                                {/* Dashboard Header Tabs - Mobile Only */}
                                <div className="lg:hidden flex p-1 bg-white rounded-2xl shadow-sm border border-slate-100 mb-2">
                                    <button 
                                        onClick={() => setActiveTab('overview')}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide transition-all ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}
                                    >
                                        Visão Geral
                                    </button>
                                    <button 
                                        onClick={() => setView('transactions')}
                                        className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide text-slate-400"
                                    >
                                        Gastos
                                    </button>
                                </div>

                                {activeTab === 'overview' && (
                                    <>
                                        {/* BALANCE OVERVIEW CARD */}
                                        <div className={`${sobraReal < 0 ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-teal-500 to-emerald-600'} rounded-3xl lg:rounded-[2.5rem] p-4 lg:p-8 text-white shadow-2xl shadow-emerald-200 border border-white/20 mb-6 lg:mb-8 relative overflow-hidden group`}>
                                            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-emerald-400/20 blur-[80px] rounded-full"></div>
                                            <div className="absolute bottom-[-10%] left-[-5%] w-48 h-48 bg-emerald-400/20 blur-[60px] rounded-full"></div>
                                            
                                            <div className="relative z-10">
                                                <div className="flex items-center gap-2 lg:gap-3 mb-4 lg:mb-6">
                                                    <div className="p-2 lg:p-2.5 bg-emerald-400/30 backdrop-blur-md text-white rounded-xl lg:rounded-2xl shadow-lg border border-white/20">
                                                        <TrendingUp size={18} className="lg:w-6 lg:h-6" strokeWidth={3} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <h3 className="text-sm lg:text-lg font-black tracking-tight">Saúde Financeira</h3>
                                                        <div className="flex items-center gap-1.5 lg:gap-2">
                                                            <div className="w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                                            <span className="text-[10px] lg:text-sm font-black opacity-90 uppercase tracking-widest leading-none">
                                                                {sobraReal < 0 ? 'ALERTA: CAIXA EM DIA NEGATIVO • ' : 'SALDO ATIVO EM DIA • '}
                                                                {Math.round((sobraReal / (latestDailyBalance || 1)) * 100)}% de sobra real/atual
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-4 xl:gap-6">
                                                    <div 
                                                        onClick={() => {
                                                            setView('transactions');
                                                            setTransactionListType('incomes');
                                                        }}
                                                        className="flex flex-col gap-0.5 lg:gap-1 cursor-pointer hover:bg-white/10 p-1.5 lg:p-2 rounded-xl lg:rounded-2xl transition-all group/stat col-span-1"
                                                    >
                                                        <span className="text-[9px] lg:text-sm font-black uppercase tracking-widest opacity-80 group-hover/stat:opacity-100 flex items-center gap-1 flex-wrap">
                                                            Receitas (Entradas)
                                                            <ArrowRight size={10} className="lg:w-3.5 lg:h-3.5 opacity-0 group-hover/stat:opacity-100 transition-all -translate-x-2 group-hover/stat:translate-x-0" />
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-base lg:text-2xl font-black tracking-tighter">
                                                                {formatCurrency(stats.combined.total)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 lg:gap-2 mt-0.5">
                                                            <div className="flex-1 bg-white/10 h-1 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full rounded-full ${sobraReal < 0 ? 'bg-red-200' : 'bg-white'}`} 
                                                                    style={{ width: `${Math.min(100, (stats.realExpenses.total / (stats.combined.total || 1)) * 100)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest leading-none shrink-0">{Math.round((stats.realExpenses.total / (stats.combined.total || 1)) * 100)}%</span>
                                                        </div>
                                                    </div>

                                                    <div 
                                                        onClick={() => {
                                                            const trackerElement = document.getElementById('daily-balance-tracker-widget');
                                                            if (trackerElement) {
                                                                trackerElement.scrollIntoView({ behavior: 'smooth' });
                                                            }
                                                        }}
                                                        className="flex flex-col gap-0.5 lg:gap-1 cursor-pointer hover:bg-white/10 p-1.5 lg:p-2 rounded-xl lg:rounded-2xl transition-all group/stat col-span-1"
                                                    >
                                                        <span className="text-[9px] lg:text-sm font-black uppercase tracking-widest opacity-80 group-hover/stat:opacity-100 flex items-center gap-1 text-emerald-100 flex-wrap">
                                                            Receita Real (Contas)
                                                            <ArrowRight size={10} className="lg:w-3.5 lg:h-3.5 opacity-0 group-hover/stat:opacity-100 transition-all -translate-x-2 group-hover/stat:translate-x-0" />
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-base lg:text-2xl font-black tracking-tighter text-white">
                                                                {formatCurrency(latestDailyBalance)}
                                                            </span>
                                                        </div>
                                                        <div className="text-[8px] lg:text-[10px] font-black uppercase text-emerald-200/80 tracking-widest leading-none mt-1">
                                                            Saldos em Conta (Hoje)
                                                        </div>
                                                    </div>

                                                    <div 
                                                        onClick={() => {
                                                            setView('transactions');
                                                            setTransactionListType('expenses');
                                                        }}
                                                        className="flex flex-col gap-0.5 lg:gap-1 cursor-pointer hover:bg-white/10 p-1.5 lg:p-2 rounded-xl lg:rounded-2xl transition-all group/stat col-span-2 lg:col-span-1"
                                                    >
                                                        <span className="text-[9px] lg:text-sm font-black uppercase tracking-widest opacity-80 group-hover/stat:opacity-100 flex items-center gap-1 flex-wrap">
                                                            Despesas
                                                            <ArrowRight size={10} className="lg:w-3.5 lg:h-3.5 opacity-0 group-hover/stat:opacity-100 transition-all -translate-x-2 group-hover/stat:translate-x-0" />
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-base lg:text-2xl font-black tracking-tighter text-emerald-100">
                                                                {formatCurrency(stats.realExpenses.total)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 lg:gap-2 mt-0.5">
                                                            <div className="flex-1 bg-white/10 h-1 rounded-full overflow-hidden">
                                                                <div className="h-full bg-emerald-200 rounded-full" style={{ width: `${Math.min(100, (stats.realExpenses.total / (stats.combined.total || 1)) * 100)}%` }}></div>
                                                            </div>
                                                            <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest leading-none shrink-0">
                                                                {Math.round((stats.realExpenses.total / (stats.combined.total || 1)) * 100)}%
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-0.5 lg:gap-1 p-1.5 lg:p-2 rounded-xl lg:rounded-2xl border border-white/10 bg-white/5 col-span-1">
                                                        <span className="text-[9px] lg:text-sm font-black uppercase tracking-widest opacity-85 text-white">Sobra Ideal</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-base lg:text-2xl font-black tracking-tighter text-white">
                                                                {formatCurrency(stats.surplusRaw)}
                                                            </span>
                                                        </div>
                                                        <div className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest leading-none text-slate-100 opacity-80 mt-1 whitespace-nowrap">
                                                            Planejada (Simulação)
                                                        </div>
                                                    </div>

                                                    <div className={`col-span-1 ${sobraReal < 0 ? 'bg-red-400/20 border-red-300' : 'bg-emerald-400/20 border-emerald-300'} backdrop-blur-md rounded-xl lg:rounded-2xl p-2.5 lg:p-4 border flex flex-col gap-0.5 shadow-inner transition-all hover:bg-emerald-400/30 text-white`}>
                                                        <span className="text-[9px] lg:text-sm font-black uppercase tracking-widest opacity-95 text-white">Sobra Real</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-base lg:text-2xl font-black tracking-tighter text-white">
                                                                {formatCurrency(sobraReal)}
                                                            </span>
                                                        </div>
                                                        <div className={`text-[8px] lg:text-[10px] font-black uppercase tracking-widest leading-none mt-1 ${sobraReal < 0 ? 'text-red-200' : 'text-emerald-100'}`}>
                                                            Atual (Hoje)
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* QUITAÇÃO DE DÍVIDAS EM ABERTO (USER REQUESTED: BASED ON REAL REVENUE R$1641.62 IN SANTANDER + R$598 BUDGET/CREDIT FROM MUMBUCA) */}
                                        <div className="bg-white/45 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-4 lg:p-8 border border-white/60 shadow-xl shadow-slate-200/40 mb-6 lg:mb-8">
                                            <div className="flex items-center gap-2 lg:gap-3 mb-6 lg:mb-8">
                                                <div className="p-2 lg:p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                                                    <Wallet size={18} className="lg:w-6 lg:h-6" strokeWidth={3} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <h2 className="text-sm lg:text-base font-black text-slate-800 tracking-tight">O que falta para quitar as Dívidas em Aberto?</h2>
                                                    <span className="text-[10px] lg:text-sm font-black text-slate-400 uppercase tracking-wide">
                                                        Demonstrativo Real baseando-se nos recursos disponíveis
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
                                                {/* Card 1: Open Debts */}
                                                <div className="bg-white rounded-2xl p-4 lg:p-6 border border-slate-50 shadow-sm flex flex-col justify-between">
                                                    <span className="text-[9px] lg:text-xs font-black text-slate-400 uppercase tracking-widest">Contas em Aberto</span>
                                                    <span className="text-xl lg:text-2xl font-black text-rose-600 tracking-tight mt-1">
                                                        {formatCurrency(stats.realExpenses.unpaid)}
                                                    </span>
                                                    <span className="text-[9px] lg:text-[10px] mt-2 font-bold text-slate-400">
                                                        Total de boletos não pagos
                                                    </span>
                                                </div>

                                                {/* Card 2: Real income in Santander */}
                                                <div className="bg-white rounded-2xl p-4 lg:p-6 border border-slate-50 shadow-sm flex flex-col justify-between">
                                                    <span className="text-[9px] lg:text-xs font-black text-slate-400 uppercase tracking-widest">Saldo Real (Santander)</span>
                                                    <span className="text-xl lg:text-2xl font-black text-emerald-600 tracking-tight mt-1">
                                                        {formatCurrency(bankReserves.santander || 1641.62)}
                                                    </span>
                                                    <span className="text-[9px] lg:text-[10px] mt-2 font-bold text-slate-400">
                                                        Disponível no Santander
                                                    </span>
                                                </div>

                                                {/* Card 3: Mumbuca Credit */}
                                                <div className="bg-white rounded-2xl p-4 lg:p-6 border border-slate-50 shadow-sm flex flex-col justify-between">
                                                    <span className="text-[9px] lg:text-xs font-black text-slate-400 uppercase tracking-wide tracking-widest">Crédito Mumbuca</span>
                                                    <span className="text-xl lg:text-2xl font-black text-teal-600 tracking-tight mt-1">
                                                        {formatCurrency(598.00)}
                                                    </span>
                                                    <span className="text-[9px] lg:text-[10px] mt-2 font-bold text-slate-400">
                                                        Entrada prevista
                                                    </span>
                                                </div>

                                                {/* Card 4: Missing Amount */}
                                                {(() => {
                                                    const santanderBase = bankReserves.santander || 1641.62;
                                                    const mumbucaInflow = 598.00;
                                                    const totalResources = santanderBase + mumbucaInflow;
                                                    const missingForDebts = stats.realExpenses.unpaid - totalResources;
                                                    const isDeficit = missingForDebts > 0;
                                                    
                                                    return (
                                                        <div className={`rounded-2xl p-4 lg:p-6 border shadow-sm flex flex-col justify-between ${
                                                            isDeficit 
                                                                ? 'bg-amber-50/70 border-amber-100 text-amber-900' 
                                                                : 'bg-emerald-50/70 border-emerald-100 text-emerald-950'
                                                        }`}>
                                                            <span className="text-[9px] lg:text-xs font-black uppercase tracking-widest opacity-80">
                                                                {isDeficit ? 'Quanto Ainda Preciso' : 'Saldo Suficiente'}
                                                            </span>
                                                            <span className="text-xl lg:text-2xl font-black tracking-tight mt-1">
                                                                {isDeficit ? formatCurrency(missingForDebts) : 'R$ 0,00'}
                                                            </span>
                                                            <span className="text-[9px] lg:text-[10px] mt-2 font-bold opacity-80">
                                                                {isDeficit 
                                                                    ? 'Déficit para zerar as contas' 
                                                                    : 'Contas totalmente cobertas!'}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Open Debts Detailed List */}
                                            {(() => {
                                                const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
                                                const isExcluded = (t: Transaction) => {
                                                    if (t.skipped) return true;
                                                    if (!t.isSuspended) return false;
                                                    if (!t.suspendedUntil) return true;
                                                    return currentMonthStr < t.suspendedUntil;
                                                };
                                                const unpaidItems = [
                                                    ...monthData.expenses.filter(e => !isExcluded(e) && !e.paid),
                                                    ...monthData.avulsosItems.filter(e => !isExcluded(e) && !e.paid)
                                                ].sort((a, b) => a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' }));

                                                if (unpaidItems.length === 0) {
                                                    return (
                                                        <div className="bg-emerald-50/30 border border-emerald-150 rounded-2xl p-4 text-center text-emerald-800 font-bold text-sm">
                                                            🎉 Parabéns! Não há contas em aberto pendentes para este mês.
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="bg-white rounded-2xl border border-slate-100 p-4 lg:p-6 shadow-sm">
                                                        <h3 className="text-xs lg:text-sm font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center justify-between">
                                                            <span>Relação de Contas em Aberto ({unpaidItems.length})</span>
                                                            <span className="text-[10px] text-slate-400 font-extrabold normal-case">Dívidas sem marcar como pagas</span>
                                                        </h3>
                                                        <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                                                            {unpaidItems.map(item => (
                                                                <div key={item.id} className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100">
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        <span className="text-sm select-none shrink-0 opacity-80">
                                                                            {item.category === 'Moradia' ? '🏠' :
                                                                             item.category === 'Alimentação' ? '🛒' :
                                                                             item.category === 'Transporte' ? '🚗' :
                                                                             item.category === 'Saúde' ? '💊' :
                                                                             item.category === 'Educação' ? '📚' :
                                                                             item.category === 'Lazer' ? '🎉' :
                                                                             item.category === 'Dívidas' ? '💸' : '📝'}
                                                                        </span>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-xs lg:text-sm font-black text-slate-800 truncate">
                                                                                {item.description}
                                                                            </span>
                                                                            <span className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                                {item.group || item.category} {item.installments ? `• ${item.installments.current}/${item.installments.total}` : ''}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-xs lg:text-sm font-black text-slate-800 whitespace-nowrap ml-2">
                                                                        {formatCurrency(item.amount)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* DAILY PALPABLE BALANCE TRACKER */}
                                        <DailyBalanceTracker 
                                            dailyBalances={monthData.dailyBalances || []} 
                                            onUpdateBalances={handleUpdateDailyBalances} 
                                        />

                                        {/* EXPENSES BY CATEGORY CARD */}
                                        <div className="bg-white/40 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-4 lg:p-8 border border-white/60 shadow-xl shadow-slate-200/40 mb-6 lg:mb-8">
                                            <div className="flex items-center gap-2 lg:gap-3 mb-6 lg:mb-8">
                                                <div className="p-2 lg:p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                                                    <Users size={18} className="lg:w-6 lg:h-6" strokeWidth={3} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <h2 className="text-sm lg:text-base font-black text-slate-800 tracking-tight">Despesas por Categoria</h2>
                                                    <span className="text-[10px] lg:text-sm font-black text-slate-400 uppercase tracking-wide">
                                                        Pendente: {formatCurrency(groupedDebts.reduce((acc, g) => acc + (g.total - g.paidAmount), 0))}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                                                {groupedDebts.map(group => (
                                                    <button key={group.name} onClick={() => handleFilter('group', group.name)} className="bg-white rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-slate-50 shadow-sm flex items-center justify-between group hover:shadow-md transition-all w-full text-left">
                                                        <div className="flex items-center gap-3 lg:gap-4 overflow-hidden">
                                                            <div className={`w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br ${getDebtColor(group.name)} text-white flex items-center justify-center shrink-0 shadow-lg shadow-slate-200/50`}>
                                                                <User size={20} strokeWidth={2.5} className="lg:w-6 lg:h-6" />
                                                            </div>
                                                            <div className="flex flex-col overflow-hidden">
                                                                <span className="text-[9px] lg:text-xs font-black text-slate-400 uppercase tracking-widest truncate">{group.name}</span>
                                                                <span className="text-base lg:text-xl font-black text-slate-850 tracking-tight truncate">
                                                                    Falta: {formatCurrency(group.total - group.paidAmount)}
                                                                </span>
                                                                <div className="flex flex-col gap-1 mt-2 text-[10px] lg:text-xs font-bold w-full">
                                                                    <div className="flex items-center justify-between text-emerald-600 bg-emerald-50/70 px-2 py-0.5 rounded-md">
                                                                        <span>Pago:</span>
                                                                        <span className="font-extrabold">{formatCurrency(group.paidAmount)}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-slate-605 bg-slate-50 px-2 py-0.5 rounded-md">
                                                                        <span>Total:</span>
                                                                        <span className="font-extrabold">{formatCurrency(group.total)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="p-2 lg:p-3 bg-slate-50 rounded-lg text-slate-300 group-hover:text-rose-500 transition-colors shrink-0">
                                                            <ArrowRight size={16} className="lg:w-5 lg:h-5" />
                                                        </div>
                                                    </button>
                                                ))}
                                                {groupedDebts.length === 0 && (
                                                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 gap-4">
                                                        <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
                                                            <PiggyBank size={40} />
                                                        </div>
                                                        <span className="text-base font-black">Nenhuma dívida pendente com familiares!</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* CATEGORY OVERVIEW - Matching Screenshot 3 */}
                                        <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] p-6 lg:p-8 border border-white/60 shadow-xl shadow-slate-200/40">
                                            <div className="flex items-center gap-3 mb-8">
                                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                                                    <PiggyBank size={24} strokeWidth={3} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <h2 className="text-base font-black text-slate-800 tracking-tight">Categorização de Gastos</h2>
                                                    <span className="text-sm font-black text-slate-400 uppercase tracking-wide">
                                                        Total: {formatCurrency(stats.realExpenses.total)}
                                                    </span>
                                                </div>
                                            </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                                            {(() => {
                                                const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
                                                const isExcluded = (t: any) => {
                                                    if (t.skipped) return true;
                                                    if (!t.isSuspended) return false;
                                                    if (!t.suspendedUntil) return true;
                                                    return currentMonthStr < t.suspendedUntil;
                                                };
                                                const allExps = [
                                                    ...monthData.expenses.filter(e => !isExcluded(e)),
                                                    ...monthData.avulsosItems.filter(e => !isExcluded(e))
                                                ];
                                                const catsSet = new Set(allExps.map(e => e.category));
                                                const cats = Array.from(catsSet).sort();
                                                return cats.map(cat => {
                                                    const catExps = allExps.filter(e => e.category === cat);
                                                    const amount = catExps.reduce((s, e) => s + (e.amount || 0), 0);
                                                    const paidAmount = catExps.filter(e => e.paid).reduce((s, e) => s + (e.amount || 0), 0);
                                                    const pendingAmount = catExps.filter(e => !e.paid).reduce((s, e) => s + (e.amount || 0), 0);
                                                    
                                                    const totalExpenses = stats.realExpenses.total || 1;
                                                    const percent = Math.round((amount / totalExpenses) * 100);
                                                    
                                                    const getCatStyle = (c: string) => {
                                                        const cn = c.toUpperCase();
                                                        if (cn.includes('DÍVIDAS') || cn.includes('DIVIDAS')) return { bg: 'bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500', icon: ShoppingCart };
                                                        if (c === 'Moradia') return { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500', icon: HomeIcon };
                                                        if (c === 'Lazer') return { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500', icon: Palmtree };
                                                        if (c === 'Saúde') return { bg: 'bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500', icon: Heart };
                                                        if (c === 'Outros') return { bg: 'bg-slate-50', text: 'text-slate-600', bar: 'bg-slate-500', icon: Wallet };
                                                        if (c === 'Transporte') return { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500', icon: Car };
                                                        if (c === 'Educação') return { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500', icon: GraduationCap };
                                                        if (c === 'Alimentação') return { bg: 'bg-orange-50', text: 'text-orange-600', bar: 'bg-orange-500', icon: ShoppingBag };
                                                        return { bg: 'bg-gray-50', text: 'text-gray-600', bar: 'bg-gray-500', icon: MoreHorizontal };
                                                    };
                                                    
                                                    const s = getCatStyle(cat);
                                                    const Icon = s.icon;

                                                    return (
                                                        <button key={cat} onClick={() => handleFilter('category', cat)} className="bg-white rounded-2xl lg:rounded-3xl p-3 lg:p-4 border border-slate-50 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-4 group hover:shadow-md transition-all overflow-hidden w-full text-left">
                                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl ${s.bg} ${s.text} flex items-center justify-center shrink-0`}>
                                                                    <Icon size={20} strokeWidth={2.5} className="lg:w-6 lg:h-6" />
                                                                </div>
                                                                <div className="flex flex-col sm:hidden overflow-hidden flex-1">
                                                                    <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{cat}</span>
                                                                    <span className="text-sm lg:text-base font-black text-slate-800 tracking-tight truncate">
                                                                        {formatCurrency(amount)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 flex flex-col gap-0.5 overflow-hidden w-full">
                                                                <span className="hidden sm:inline text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{cat}</span>
                                                                <span className="hidden sm:inline text-sm lg:text-base font-black text-slate-800 tracking-tight truncate">
                                                                    {formatCurrency(amount)}
                                                                </span>
                                                                <div className="w-full bg-slate-100 h-1 rounded-full mt-0.5 lg:mt-1 overflow-hidden">
                                                                    <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${percent}%` }}></div>
                                                                </div>
                                                                
                                                                <div className="flex flex-col gap-1 mt-2 text-[10px] lg:text-xs font-bold w-full">
                                                                    <div className="flex items-center justify-between text-emerald-600 bg-emerald-50/70 px-2 py-0.5 rounded-md">
                                                                        <span>Pago:</span>
                                                                        <span className="font-extrabold">{formatCurrency(paidAmount)}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-rose-600 bg-rose-50/70 px-2 py-0.5 rounded-md">
                                                                        <span>Falta:</span>
                                                                        <span className="font-extrabold">{formatCurrency(pendingAmount)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="relative w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center shrink-0 ml-auto sm:ml-1 mt-2 sm:mt-0">
                                                                <svg className="w-full h-full transform -rotate-90">
                                                                    <circle cx="50%" cy="50%" r="42%" fill="transparent" stroke="currentColor" strokeWidth="3" className="text-slate-100" />
                                                                    <circle cx="50%" cy="50%" r="42%" fill="transparent" stroke="currentColor" strokeWidth="3" strokeDasharray="100" strokeDashoffset={100 - percent} className={s.text} strokeLinecap="round" />
                                                                </svg>
                                                                <span className="absolute text-[7px] lg:text-[8px] font-black text-slate-600">{percent}%</span>
                                                            </div>
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                        </div>




                                    </>
                                )}
                            </motion.div>
                        )}

                        {view === 'statistics' && (
                            <motion.div
                                key="statistics"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.5 }}
                                className="w-full flex flex-col gap-8 max-w-7xl mx-auto"
                            >
                                <Statistics monthData={monthData} currentMonth={currentMonth} currentYear={currentYear} />
                            </motion.div>
                        )}

                        {view === 'settlements' && (
                            <motion.div
                                key="settlements"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.5 }}
                                className="w-full flex flex-col gap-8 max-w-7xl mx-auto"
                            >
                                <Settlements 
                                    monthData={monthData} 
                                    onUpdateSettlements={handleUpdateSettlements} 
                                    onBack={() => setView('home')}
                                />
                            </motion.div>
                        )}

                        {view === 'transactions' && (
                            <motion.div 
                                key="transactions"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.5 }}
                                className="max-w-4xl mx-auto flex flex-col gap-5"
                            >
                                <div className="sticky top-0 z-20 pt-2 pb-2 backdrop-blur-sm">
                                    <div className="flex p-1.5 bg-white/80 border border-white rounded-2xl shadow-lg shadow-slate-200/50 backdrop-blur-md">
                                        {(['incomes', 'expenses', 'avulsosItems'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    setTransactionListType(type);
                                                    setFilter({ type: 'none', value: '' });
                                                }}
                                                className={`flex-1 py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all border ${getTabStyle(type)}`}
                                            >
                                                {type === 'incomes' ? 'Entradas' : 
                                                 type === 'expenses' ? 'Despesas' :
                                                 'Avulsos'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <TransactionList 
                                    transactions={filteredTransactions}
                                    onTogglePaid={(id, paid) => handleTogglePaid(id, paid, transactionListType)}
                                    onEdit={handleEditTransaction}
                                    onUpdate={(updated) => handleSaveTransaction(updated, transactionListType)}
                                />
                            </motion.div>
                        )}


                    </AnimatePresence>
                </main>

                {/* Floating Action Button (FAB) moved up for mobile navigation */}
                <button 
                    onClick={handleAddNewTransaction}
                    className="fixed bottom-20 lg:bottom-24 right-5 w-14 h-14 lg:w-16 lg:h-16 bg-slate-900 text-white rounded-[1.2rem] lg:rounded-[1.5rem] shadow-2xl shadow-slate-900/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 group"
                >
                    <Plus size={28} strokeWidth={3} className="lg:w-8 lg:h-8 group-hover:rotate-90 transition-transform duration-300" />
                </button>
            </div>
        </div>
    );
};

export default App;
