import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Calculator, PlaneTakeoff, AlertCircle, 
  CheckCircle2, Wallet, TrendingDown, Target, ArrowRight,
  PiggyBank, Receipt, MapPin, Sparkles, BrainCircuit, RefreshCw, Loader2, HelpCircle
} from 'lucide-react';
import { MonthData } from '../types';
import { formatCurrency, generateMonthData, getStorageKey } from '../utils/financeUtils';
import { getFinancialAdvice } from '../services/geminiService';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth, isConfigured } from '../services/firebaseConfig';
import { FAMILY_ID, MONTH_NAMES } from '../constants';

interface FlightPlanProps {
  monthData: MonthData | null;
}

interface Conta {
  id: number;
  nome: string;
  valor: string;
}

const TARGET_FIXED_DEBTS = [
  { key: 'aluguel', nome: 'Aluguel', defaultVal: 1300.00, match: (d: string) => d.includes('ALUGUEL') },
  { key: 'inter_andre', nome: 'Cartão do Inter do André', defaultVal: 386.00, match: (d: string) => d.includes('INTER') && (d.includes('ANDRÉ') || d.includes('ANDRE')) },
  { key: 'itau_marcelly', nome: 'Cartão do Itaú da Marcelly', defaultVal: 200.00, match: (d: string) => (d.includes('ITAÚ') || d.includes('ITAU')) && d.includes('MARCELLY') },
  { key: 'itau_andre', nome: 'Cartão do Itaú do André', defaultVal: 116.00, match: (d: string) => (d.includes('ITAÚ') || d.includes('ITAU')) && (d.includes('ANDRÉ') || d.includes('ANDRE')) && !d.includes('MARCELLY') },
  { key: 'internet', nome: 'Internet da Casa', defaultVal: 125.00, match: (d: string) => d.includes('INTERNET DA CASA') || d.includes('INTERNET') && d.includes('CASA') },
  { key: 'psicologa', nome: 'Psicóloga da Marcelly', defaultVal: 280.00, match: (d: string) => d.includes('PSICÓLOGA') || d.includes('PSICOLOGA') },
  { key: 'remedios', nome: 'Remédios do André', defaultVal: 400.00, match: (d: string) => d.includes('REMÉDIO') || d.includes('REMEDIO') },
  { key: 'seguro', nome: 'Seguro do Carro', defaultVal: 143.00, match: (d: string) => d.includes('SEGURO DO CARRO') || d.includes('SEGURO') && d.includes('CARRO') },
  { key: 'appai_andre', nome: 'APPAI do André', defaultVal: 129.50, match: (d: string) => d.includes('APPAI') && (d.includes('ANDRÉ') || d.includes('ANDRE')) },
  { key: 'appai_marcelly', nome: 'APPAI da Marcelly', defaultVal: 110.00, match: (d: string) => d.includes('APPAI') && d.includes('MARCELLY') },
  { key: 'intermedica', nome: 'Intermédica do André', defaultVal: 123.00, match: (d: string) => d.includes('INTERMÉDICA') || d.includes('INTERMEDICA') }
];

const getFixedContas = (mData: MonthData | null): Conta[] => {
  const expenses = mData?.expenses || [];
  return TARGET_FIXED_DEBTS.map((target, idx) => {
    // Try to find matching expense in the actual database
    const match = expenses.find(e => target.match((e.description || '').toUpperCase()));
    // If found, and not suspended (we can include it even if skipped, as it is a standard fixed debt of the family)
    const finalVal = match && !match.isSuspended ? match.amount : target.defaultVal;
    return {
      id: idx + 1,
      nome: target.nome,
      valor: finalVal.toFixed(2)
    };
  });
};

export default function FlightPlan({ monthData }: FlightPlanProps) {
  const [renda, setRenda] = useState('');
  const [contas, setContas] = useState<Conta[]>(getFixedContas(null));
  const [divida, setDivida] = useState('');
  const [parcela, setParcela] = useState('');
  const [metaViagem, setMetaViagem] = useState('');
  const [simulado, setSimulado] = useState(false);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  
  // AI advice state
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Average joint income states
  const [loadingAverage, setLoadingAverage] = useState(false);
  const [averageIncome, setAverageIncome] = useState<number | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<{
    totalIncomes: number;
    monthsData: Array<{ month: number; name: string; sum: number; items: string[] }>;
  } | null>(null);
  const [showAverageDetails, setShowAverageDetails] = useState(false);

  // Auto animation mount
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  // Fetch and calculate average joint income across 12 months of 2026
  useEffect(() => {
    const fetchAndCalculateAverage = async () => {
      setLoadingAverage(true);
      try {
        let totalSum = 0;
        const detailsList: Array<{ month: number; name: string; sum: number; items: string[] }> = [];
        
        for (let m = 1; m <= 12; m++) {
          let mData: MonthData | null = null;
          const key = getStorageKey(2026, m);
          
          // 1. Try to fetch from Firestore if configured
          if (isConfigured && auth?.currentUser) {
            try {
              const docRef = doc(db, 'families', FAMILY_ID, 'months', `2026_${m}`);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                mData = snap.data() as MonthData;
              }
            } catch (err) {
              console.warn(`Failed to fetch 2026_${m} from Firestore, using fallback`, err);
            }
          }
          
          // 2. Try LocalStorage
          if (!mData) {
            const local = localStorage.getItem(key);
            if (local) {
              try {
                mData = JSON.parse(local);
              } catch (e) {
                console.warn("Failed to parse local storage for key", key);
              }
            }
          }
          
          // 3. Fallback to generateMonthData
          if (!mData) {
            mData = generateMonthData(2026, m);
          }
          
          // Now compute fixed incomes for this month
          let monthSum = 0;
          const matchedItems: string[] = [];
          
          if (mData && mData.incomes) {
            mData.incomes.forEach(inc => {
              const desc = (inc.description || '').toUpperCase();
              
              const isSalarioAndre = desc.includes('SALARIO ANDRE') || desc.includes('SALÁRIO ANDRÉ') || desc.includes('SALÁRIO ANDRE') || desc.includes('SALARIO ANDRÉ');
              const isSalarioMarcelly = desc.includes('SALARIO MARCELLY') || desc.includes('SALÁRIO MARCELLY');
              const isFerias = desc.includes('FERIAS') || desc.includes('FÉRIAS');
              const isDecimoTerceiro = desc.includes('13º') || desc.includes('13O') || desc.includes('13') || desc.includes('DÉCIMO') || desc.includes('DECIMO');
              const isMumbucaMarcelly = desc.includes('MUMBUCA') && (desc.includes('MARCELLY') || !desc.includes('ANDRE'));
              
              if (isSalarioAndre || isSalarioMarcelly || isFerias || isDecimoTerceiro || isMumbucaMarcelly) {
                monthSum += inc.amount;
                matchedItems.push(`${inc.description}: ${formatCurrency(inc.amount)}`);
              }
            });
          }
          
          totalSum += monthSum;
          detailsList.push({
            month: m,
            name: MONTH_NAMES[m - 1],
            sum: monthSum,
            items: matchedItems
          });
        }
        
        const avg = totalSum / 12;
        setAverageIncome(avg);
        setCalculationDetails({
          totalIncomes: totalSum,
          monthsData: detailsList
        });
        
        // Auto-set the renda value
        setRenda(avg.toFixed(2));
        
      } catch (err) {
        console.error("Error calculating average joint income:", err);
      } finally {
        setLoadingAverage(false);
      }
    };
    
    fetchAndCalculateAverage();
  }, []);

  // Automatically pre-populate Custo de Vida from monthData when it is available
  useEffect(() => {
    if (!monthData || hasAutoLoaded) return;

    // Load target fixed expenses using our custom matcher
    const activeExpenses = getFixedContas(monthData);
    setContas(activeExpenses);

    // Load debt/loan amounts
    const totalDebt = monthData.expenses
      .filter(e => !e.isSuspended && !e.skipped)
      .filter(e => {
        const desc = e.description.toUpperCase();
        return desc.includes('EMPRÉSTIMO') || desc.includes('CARTÃO') || desc.includes('DÍVIDA') || desc.includes('DIVIDA');
      })
      .reduce((acc, curr) => acc + curr.amount, 0);

    if (totalDebt > 0) {
      setDivida(totalDebt.toFixed(2));
    } else {
      setDivida('1500');
    }

    // Default simulation inputs if not already set
    setParcela(prev => prev || '300');
    setMetaViagem(prev => prev || '4000');
    setSimulado(true);
    setHasAutoLoaded(true);
  }, [monthData, hasAutoLoaded]);

  const formatar = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const parseNum = (val: string | number) => {
    if (typeof val === 'number') return val;
    return parseFloat(val) || 0;
  };

  const handleAddConta = () => setContas([...contas, { id: Date.now(), nome: '', valor: '' }]);
  const handleRemoveConta = (id: number) => setContas(contas.filter(c => c.id !== id));
  const handleUpdateConta = (id: number, field: 'nome' | 'valor', value: string) => {
    setContas(contas.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // Pre-populate with current month's real data
  const handlePrepopulate = () => {
    if (!monthData) return;

    // Sum incomes
    const totalIncomes = monthData.incomes.reduce((acc, curr) => acc + curr.amount, 0);
    setRenda(totalIncomes > 0 ? totalIncomes.toFixed(2) : '5000');

    // Load active target fixed expenses
    const activeExpenses = getFixedContas(monthData);
    setContas(activeExpenses);

    // Load debt/loan amounts
    const totalDebt = monthData.expenses
      .filter(e => e.description.toUpperCase().includes('EMPRÉSTIMO') || e.description.toUpperCase().includes('CARTÃO') || e.description.toUpperCase().includes('DÍVIDA') || e.description.toUpperCase().includes('DIVIDA'))
      .reduce((acc, curr) => acc + curr.amount, 0);
    setDivida(totalDebt > 0 ? totalDebt.toFixed(2) : '1500');

    // Installment ideal default
    setParcela('300');
    setMetaViagem('4000');
    setSimulado(true);
    setAiAdvice('');
  };

  const numRenda = parseNum(renda);
  const poupancaMensal = numRenda * 0.3; 
  const disponivelParaViver = numRenda * 0.7; 

  const totalContas = contas.reduce((acc, curr) => acc + parseNum(curr.valor), 0);
  const sobraDepoisContas = disponivelParaViver - totalContas;
  
  const numDivida = parseNum(divida);
  const numParcela = parseNum(parcela);
  const pagamentoRealDivida = Math.min(numParcela, Math.max(0, sobraDepoisContas));
  
  const ultrapassouLimite = totalContas > disponivelParaViver;
  const numMeta = parseNum(metaViagem);

  // Projeção a partir do próximo mês até Dezembro (agosto, set, out, nov, dez) 
  const meses = ['Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  let dividaAtual = numDivida;
  let poupancaAcumulada = 0;
  let mesAtingidoIndex = -1;

  const simulacaoDados = meses.map((mes, index) => {
    poupancaAcumulada += poupancaMensal;
    if (dividaAtual > 0) {
      dividaAtual -= pagamentoRealDivida;
      if (dividaAtual < 0) dividaAtual = 0;
    }

    const atingiu = numMeta > 0 && poupancaAcumulada >= numMeta;
    if (mesAtingidoIndex === -1 && atingiu) mesAtingidoIndex = index;

    // Calcula o percentual de preenchimento da meta para a barra de progresso visual
    const percentualMeta = numMeta > 0 ? Math.min(100, (poupancaAcumulada / numMeta) * 100) : 0;

    return { mes, poupanca: poupancaAcumulada, dividaRestante: dividaAtual, atingiuMeta: atingiu, percentualMeta };
  });

  // Call Gemini for personalized AI analysis
  const handleConsultAI = async () => {
    setLoadingAi(true);
    try {
      const simulatedSummary = `
- Renda Mensal: ${formatar(numRenda)}
- Custos de Vida Fixos (Contas): ${formatar(totalContas)} (Uso de limite: ${((totalContas / disponivelParaViver) * 100).toFixed(1)}%)
- Dívida Total Inicial: ${formatar(numDivida)}
- Parcela de Dívida Planejada: ${formatar(numParcela)} (Pagamento real possível das sobras: ${formatar(pagamentoRealDivida)})
- Destino de Viagem (Janeiro): ${formatar(numMeta)}
- Prognóstico da viagem: ${mesAtingidoIndex !== -1 ? `Meta atingida em ${meses[mesAtingidoIndex]}!` : 'Meta de poupança INCOMPLETA até Dezembro.'}
- Dívida restante em Dezembro: ${formatar(simulacaoDados[4].dividaRestante)}
      `;

      const prompt = `
Analise o meu simulador de Plano de Voo Financeiro 70/30 para garantir minha viagem de férias em Janeiro de 2027 e me livrar de dívidas. 
Aqui estão meus dados e projeção simulada:
${simulatedSummary}

Por favor, forneça uma consultoria financeira inteligente com IA:
1. Um veredito realista sobre minhas chances e se o plano é viável.
2. Dicas estratégicas para otimizar meu custo de vida nos 70% e acelerar a saída das dívidas.
3. Conselhos sobre se devo usar parte dos 30% poupados para quitar dívidas caso estejam muito altas, ou como equilibrar os dois objetivos de forma inteligente.
Seja direto, encorajador, prático e utilize formatação em markdown limpa e bonita (negritos, tópicos). Responda em português de forma humanizada.
      `;

      const response = await getFinancialAdvice(
        monthData || { 
          incomes: [], 
          expenses: [], 
          shoppingItems: [], 
          avulsosItems: [], 
          goals: [], 
          bankAccounts: [], 
          bankReserves: { santander: 0, inter: 0, sofisa: 0 }, 
          updatedAt: Date.now() 
        },
        [], // empty projections list as we send everything inside the prompt
        prompt
      );
      setAiAdvice(response);
    } catch (error) {
      console.error("AI Advice Error:", error);
      setAiAdvice("Desculpe, ocorreu um erro ao consultar nossa Inteligência Financeira. Verifique se o sinal de rede está ativo.");
    } finally {
      setLoadingAi(false);
    }
  };

  // Format response markdown to react elements (handling bolding and bullets simply)
  const renderFormattedAdvice = (text: string) => {
    return text.split('\n').map((line, i) => {
      let trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-2"></div>;

      // Check for bullet point
      const isBullet = trimmed.startsWith('*') || trimmed.startsWith('-');
      if (isBullet) {
        trimmed = trimmed.substring(1).trim();
      }

      // Check for bold matches (**text**)
      const parts = [];
      let currentIndex = 0;
      const boldRegex = /\*\*(.*?)\*\*/g;
      let match;

      while ((match = boldRegex.exec(trimmed)) !== null) {
        if (match.index > currentIndex) {
          parts.push(trimmed.substring(currentIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-extrabold text-slate-950">{match[1]}</strong>);
        currentIndex = boldRegex.lastIndex;
      }

      if (currentIndex < trimmed.length) {
        parts.push(trimmed.substring(currentIndex));
      }

      return (
        <p key={i} className={`text-slate-700 text-sm md:text-base leading-relaxed ${isBullet ? 'pl-4 relative before:content-["•"] before:absolute before:left-0 before:text-emerald-500 before:font-bold' : ''}`}>
          {parts.length > 0 ? parts : trimmed}
        </p>
      );
    });
  };

  return (
    <div className={`w-full max-w-6xl mx-auto space-y-8 pb-24 transition-opacity duration-700 ${montado ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* HEADER MODERNO */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-200/60 hover:shadow-md transition-all">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-100 p-3 rounded-2xl">
              <Target className="w-8 h-8 text-emerald-600 animate-pulse" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">
              Plano de Voo <span className="text-emerald-500">2027</span>
            </h1>
          </div>
          <p className="text-slate-500 font-medium ml-1">Gerenciamento lógico 70/30 para garantir sua viagem em Janeiro.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {monthData && (
            <button
              onClick={handlePrepopulate}
              className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs uppercase tracking-wider px-4 py-3 rounded-2xl border border-emerald-200/50 transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              Preencher com Dados do Mês
            </button>
          )}
          {numRenda > 0 && (
            <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Renda</p>
                <p className="text-lg font-black text-slate-700">{formatar(numRenda)}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* GRID PRINCIPAL (BENTO BOX) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: RENDA E DIVISÃO */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* CARD 1: RENDA E BARRA 70/30 */}
          <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-200/60 transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-indigo-100 p-2.5 rounded-xl"><Wallet className="w-6 h-6 text-indigo-600" /></div>
              <h2 className="text-xl font-bold text-slate-800">Ponto de Partida (Sua Renda)</h2>
            </div>
            
            <div className="relative mb-6 group">
              <span className="absolute left-4 top-4 text-slate-400 font-medium">R$</span>
              <input
                type="number"
                value={renda}
                onChange={(e) => {
                  setRenda(e.target.value);
                  setSimulado(false);
                }}
                placeholder="Ex: 5000"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-indigo-400 text-lg font-semibold text-slate-700 outline-none transition-all"
              />
            </div>

            {/* INFORMAÇÃO DA RENDA MÉDIA CONJUNTA */}
            <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/60 text-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {loadingAverage ? (
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  )}
                  <span className="font-bold text-slate-700">Média Conjunta de Entrada (2026):</span>
                  {averageIncome !== null && (
                    <span className="font-extrabold text-slate-900 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs">
                      {formatCurrency(averageIncome)} /mês
                    </span>
                  )}
                </div>
                
                <button
                  onClick={() => setShowAverageDetails(!showAverageDetails)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  {showAverageDetails ? 'Ocultar detalhes' : 'Como foi calculado?'}
                </button>
              </div>
              
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Esta média foi calculada somando todas as entradas fixas de janeiro a dezembro de 2026 (Salário André, Salário Marcelly, 13º Salário, Férias e Mumbuca Marcelly) e dividindo por 12. Os dados são sincronizados em tempo real com o seu banco de dados.
              </p>

              {showAverageDetails && calculationDetails && (
                <div className="mt-4 pt-3 border-t border-slate-200/60 space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                  <div className="flex justify-between font-bold text-xs text-slate-500 pb-1">
                    <span>Mês</span>
                    <span>Soma das Rendas Fixas</span>
                  </div>
                  {calculationDetails.monthsData.map((item) => (
                    <div key={item.month} className="group/month border-b border-slate-100 pb-1 last:border-0">
                      <div className="flex justify-between items-center text-xs py-1 hover:bg-slate-100/50 rounded-lg px-1 transition-colors cursor-help">
                        <span className="font-medium text-slate-600">{item.name}</span>
                        <span className="font-bold text-slate-800">{formatCurrency(item.sum)}</span>
                      </div>
                      {item.items.length > 0 && (
                        <div className="pl-3 pb-1 border-l border-slate-200/50 text-[11px] text-slate-400 space-y-0.5 mt-0.5">
                          {item.items.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                              <span>{it}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-200/60 flex justify-between font-extrabold text-xs text-indigo-700">
                    <span>Soma Anual Conjunta:</span>
                    <span>{formatCurrency(calculationDetails.totalIncomes)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* BARRA VISUAL 70/30 */}
            <div className={`transition-all duration-500 overflow-hidden ${numRenda > 0 ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
              <p className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Como seu dinheiro será dividido automaticamente:
              </p>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner mb-4">
                <div className="bg-emerald-500 h-full transition-all duration-1000 ease-out" style={{ width: '30%' }}></div>
                <div className="bg-blue-500 h-full transition-all duration-1000 ease-out delay-150" style={{ width: '70%' }}></div>
              </div>
              <div className="flex flex-col md:flex-row justify-between gap-3 text-sm">
                <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex-1">
                  <span className="font-bold text-emerald-600 block mb-1">30% Viagem (Poupar)</span>
                  <span className="text-xl font-black text-emerald-700">{formatar(poupancaMensal)}<span className="text-sm font-medium text-emerald-600/70">/mês</span></span>
                </div>
                <div className="bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 flex-1 text-left md:text-right">
                  <span className="font-bold text-blue-600 block mb-1">70% Vida & Contas</span>
                  <span className="text-xl font-black text-blue-700">{formatar(disponivelParaViver)}<span className="text-sm font-medium text-blue-600/70">/mês</span></span>
                </div>
              </div>
            </div>
          </section>

          {/* CARD 2: CONTAS FIXAS */}
          <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-200/60 relative overflow-hidden transition-all hover:shadow-md">
            {ultrapassouLimite && (
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>
            )}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2.5 rounded-xl"><Receipt className="w-6 h-6 text-blue-600" /></div>
                <h2 className="text-xl font-bold text-slate-800">Custo de Vida (Dentro dos 70%)</h2>
              </div>
              <div className="text-left md:text-right bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Comprometido</p>
                <p className={`text-xl font-black ${ultrapassouLimite ? 'text-red-500' : 'text-blue-600'}`}>
                  {formatar(totalContas)}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-1">
              {contas.map((conta) => (
                <div key={conta.id} className="flex gap-3 items-center">
                  <input
                    type="text"
                    value={conta.nome}
                    onChange={(e) => {
                      handleUpdateConta(conta.id, 'nome', e.target.value);
                      setSimulado(false);
                    }}
                    placeholder="Ex: Aluguel, Luz..."
                    className="flex-[2] w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-all font-medium text-sm"
                  />
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-3 text-slate-400 font-medium text-xs">R$</span>
                    <input
                      type="number"
                      value={conta.valor}
                      onChange={(e) => {
                        handleUpdateConta(conta.id, 'valor', e.target.value);
                        setSimulado(false);
                      }}
                      placeholder="0,00"
                      className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-all font-medium text-sm"
                    />
                  </div>
                  <button
                    onClick={() => {
                      handleRemoveConta(conta.id);
                      setSimulado(false);
                    }}
                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Remover conta"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => {
                handleAddConta();
                setSimulado(false);
              }}
              className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-100 px-5 py-3 rounded-xl transition-colors w-full justify-center border border-blue-100 border-dashed"
            >
              <Plus className="w-4 h-4" /> Adicionar Nova Despesa
            </button>

            {/* Barra de Consumo dos 70% */}
            {numRenda > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex justify-between text-sm font-semibold mb-3">
                  <span className="text-slate-500">Uso do limite (70%)</span>
                  <span className={ultrapassouLimite ? 'text-red-500 font-bold' : 'text-slate-600'}>
                    {ultrapassouLimite ? 'Limite Excedido!' : `Sobra: ${formatar(sobraDepoisContas)}`}
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full transition-all duration-700 ease-out ${ultrapassouLimite ? 'bg-red-500' : 'bg-blue-400'}`}
                    style={{ width: `${Math.min(100, (totalContas / disponivelParaViver) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* COLUNA DIREITA: DÍVIDAS E META DE VIAGEM */}
        <div className="space-y-6">
          
          {/* CARD 3: DÍVIDAS */}
          <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-200/60 transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-rose-100 p-2.5 rounded-xl"><TrendingDown className="w-6 h-6 text-rose-600" /></div>
              <h2 className="text-xl font-bold text-slate-800">Passado (Dívidas)</h2>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Dívida Total Atual</label>
                <div className="relative">
                  <span className="absolute left-4 top-4 text-slate-400 font-medium">R$</span>
                  <input
                    type="number"
                    value={divida}
                    onChange={(e) => {
                      setDivida(e.target.value);
                      setSimulado(false);
                    }}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-rose-400 outline-none transition-all font-semibold text-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Parcela Mensal Ideal</label>
                <div className="relative">
                  <span className="absolute left-4 top-4 text-slate-400 font-medium">R$</span>
                  <input
                    type="number"
                    value={parcela}
                    onChange={(e) => {
                      setParcela(e.target.value);
                      setSimulado(false);
                    }}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-rose-400 outline-none transition-all font-semibold text-slate-700"
                  />
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-3">
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    💡 A matemática cuida de você: o app só vai destinar à dívida o que <span className="text-slate-700 font-bold">sobrar</span> das suas contas nos 70%.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CARD 4: META DA VIAGEM */}
          <section className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 md:p-8 rounded-[2rem] shadow-sm border border-amber-200/60 transition-all hover:shadow-md relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
              <PlaneTakeoff className="w-48 h-48 text-amber-600" />
            </div>
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="bg-amber-100 p-2.5 rounded-xl shadow-sm"><MapPin className="w-6 h-6 text-amber-600" /></div>
              <h2 className="text-xl font-bold text-slate-800">Destino (Janeiro)</h2>
            </div>
            
            <div className="relative z-10">
              <label className="text-xs font-bold text-amber-700/80 uppercase tracking-wider mb-2 block">Custo Total (Passagem + Estadia)</label>
              <div className="relative">
                <span className="absolute left-4 top-4 text-amber-600 font-medium text-lg">R$</span>
                <input
                  type="number"
                  value={metaViagem}
                  onChange={(e) => {
                    setMetaViagem(e.target.value);
                    setSimulado(false);
                  }}
                  placeholder="Ex: 3500"
                  className="w-full pl-12 pr-4 py-4 bg-white/80 backdrop-blur-sm border-2 border-amber-200 rounded-2xl focus:border-amber-400 outline-none transition-all text-xl font-black text-amber-900 shadow-sm"
                />
              </div>
            </div>
          </section>

          {/* BOTÃO MÁGICO */}
          <button
            onClick={() => setSimulado(true)}
            disabled={numRenda <= 0 || !metaViagem}
            className={`w-full py-5 rounded-[2rem] text-lg font-black flex justify-center items-center gap-3 transition-all duration-300 shadow-xl ${
              numRenda > 0 && metaViagem
                ? 'bg-slate-900 hover:bg-slate-800 text-white hover:-translate-y-1 hover:shadow-slate-900/30 ring-4 ring-transparent hover:ring-slate-900/10' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70'
            }`}
          >
            <PlaneTakeoff className={`w-6 h-6 ${numRenda > 0 && metaViagem ? 'animate-bounce' : ''}`} />
            GERAR ROTA DA VIAGEM
          </button>

        </div>
      </div>

      {/* RESULTADO DA SIMULAÇÃO */}
      {simulado && (
        <div className="mt-12 space-y-10 animate-slide-up">
          
          {ultrapassouLimite ? (
            <div className="bg-red-50/90 backdrop-blur-md border-2 border-red-200 p-8 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 text-red-800 shadow-xl">
              <div className="bg-white p-5 rounded-full shadow-sm">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <div>
                <h3 className="font-black text-2xl mb-2">Alerta de Rota: Bloqueio Lógico</h3>
                <p className="text-lg">
                  Suas contas fixas atuais (<strong>{formatar(totalContas)}</strong>) já estouram o limite seguro de 70% da sua renda (<strong>{formatar(disponivelParaViver)}</strong>).
                </p>
                <div className="mt-4 bg-white/50 p-4 rounded-xl">
                  <p className="font-medium text-red-900">
                    💡 <strong>O que fazer?</strong> A matemática não mente. Para a viagem acontecer sem sofrimento, você precisa reduzir as despesas acima ou focar em fazer uma renda extra temporária.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              
              {/* ALERTA DE QUANDO COMPRAR */}
              {mesAtingidoIndex !== -1 ? (
                <div className="bg-emerald-600 bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-8 md:p-10 rounded-[2rem] shadow-2xl flex flex-col md:flex-row items-center gap-8 transform transition-all hover:scale-[1.01] border-4 border-white/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-10 -translate-y-10">
                    <Target className="w-64 h-64" />
                  </div>
                  <div className="bg-white/20 p-5 rounded-[2rem] backdrop-blur-md shadow-inner relative z-10">
                    <CheckCircle2 className="w-16 h-16 text-white" />
                  </div>
                  <div className="relative z-10">
                    <h2 className="text-3xl md:text-4xl font-black mb-3 flex items-center gap-2">
                      Alvo Travado! 🎯
                    </h2>
                    <p className="text-emerald-50 text-lg md:text-xl leading-relaxed">
                      Você terá <strong>{formatar(numMeta)}</strong> na mão em <strong className="bg-white text-emerald-700 px-4 py-1.5 rounded-xl uppercase tracking-wider shadow-sm mx-1">{meses[mesAtingidoIndex]}</strong>. <br className="hidden md:block"/>
                      Compre as passagens neste exato mês. Essa antecedência é o segredo para não pagar caro.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800 text-white p-8 rounded-[2rem] shadow-xl flex items-center gap-6 border-2 border-slate-700">
                  <div className="bg-amber-400/20 p-4 rounded-full">
                    <AlertCircle className="w-10 h-10 text-amber-400 flex-shrink-0" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black mb-2">Rota Incompleta</h2>
                    <p className="text-slate-300 text-lg">
                      Poupando {formatar(poupancaMensal)} por mês, você chega em Dezembro com <strong className="text-white">{formatar(simulacaoDados[4].poupanca)}</strong>. 
                      Ainda faltarão <strong className="text-amber-400">{formatar(numMeta - simulacaoDados[4].poupanca)}</strong>. Ajuste a meta ou a renda.
                    </p>
                  </div>
                </div>
              )}

              {/* TIMELINE DE PASSAGENS AÉREAS */}
              <div className="pt-4">
                <h3 className="text-2xl font-extrabold text-slate-800 mb-8 flex items-center gap-3 px-2">
                  <ArrowRight className="text-indigo-500 w-8 h-8" /> A Sua Jornada Mês a Mês
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 relative">
                  {/* Linha conectora de fundo (visível no desktop) */}
                  <div className="hidden lg:block absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 transform -translate-y-1/2 rounded-full"></div>

                  {simulacaoDados.map((dado, idx) => {
                    const isMesCompra = idx === mesAtingidoIndex;
                    return (
                      <div 
                        key={idx} 
                        className={`relative p-6 rounded-3xl border-2 transition-all duration-700 group flex flex-col bg-white
                          ${dado.atingiuMeta ? 'border-emerald-200 shadow-emerald-100/50' : 'border-slate-100'}
                          ${isMesCompra ? 'ring-4 ring-emerald-400 ring-offset-4 transform -translate-y-4 shadow-2xl z-10 scale-105' : 'shadow-md hover:-translate-y-2 hover:shadow-xl'}
                        `}
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        {/* Selo de Compra */}
                        {isMesCompra && (
                          <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg z-20 flex items-center gap-1.5 whitespace-nowrap animate-pulse">
                            <Sparkles className="w-4 h-4" /> Compre Agora
                          </div>
                        )}

                        <h4 className={`text-2xl font-black mb-5 text-center ${dado.atingiuMeta ? 'text-emerald-700' : 'text-slate-800'}`}>
                          {dado.mes}
                        </h4>
                        
                        {/* Mini visualizador de progresso da poupança */}
                        <div className="mb-6 flex-grow">
                          <p className="text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider text-center">Caixa da Viagem</p>
                          <p className={`text-xl font-black text-center ${dado.atingiuMeta ? 'text-emerald-600' : 'text-indigo-600'}`}>
                            {formatar(dado.poupanca)}
                          </p>
                          
                          {/* Barrinha preenchendo */}
                          <div className="h-2 w-full bg-slate-100 rounded-full mt-3 overflow-hidden shadow-inner">
                            <div 
                              className={`h-full transition-all duration-1000 ease-out relative ${dado.atingiuMeta ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-indigo-400 to-blue-500'}`}
                              style={{ width: `${dado.percentualMeta}%` }}
                            >
                              {dado.percentualMeta >= 100 && (
                                <div className="absolute top-0 left-0 w-full h-full bg-white/30 animate-pulse"></div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t-2 border-slate-50 border-dashed">
                          <p className="text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider text-center">Dívida Restante</p>
                          <div className="flex justify-center">
                            {dado.dividaRestante > 0 ? (
                              <p className="text-sm font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-lg">{formatar(dado.dividaRestante)}</p>
                            ) : (
                              <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg flex items-center gap-1 text-sm font-bold">
                                Quitada! <CheckCircle2 className="w-4 h-4"/>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CONSULTORIA FINANCEIRA COM INTELIGÊNCIA ARTIFICIAL */}
              <div className="bg-slate-900 bg-gradient-to-br from-slate-950 to-indigo-950 text-white rounded-[2.5rem] p-6 md:p-10 shadow-2xl border border-white/10 relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full"></div>
                
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-500/20 text-indigo-400 p-3 rounded-2xl border border-indigo-500/30">
                        <BrainCircuit className="w-8 h-8 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black">Consultoria de IA Financeira</h3>
                        <p className="text-sm text-slate-400">Analise seu plano de voo em segundos usando Inteligência Artificial.</p>
                      </div>
                    </div>
                    
                    {!aiAdvice && (
                      <button
                        onClick={handleConsultAI}
                        disabled={loadingAi}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {loadingAi ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analisando Cenários...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            Analisar com IA
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {loadingAi && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                      <p className="text-slate-400 font-bold text-sm animate-pulse uppercase tracking-wider">
                        Construindo simulação com modelos preditivos de inteligência financeira...
                      </p>
                    </div>
                  )}

                  {aiAdvice && (
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4 animate-fadeIn max-h-[500px] overflow-y-auto custom-scrollbar">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                          Conselho do Especialista
                        </span>
                        <button
                          onClick={handleConsultAI}
                          disabled={loadingAi}
                          className="text-slate-400 hover:text-white flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
                        >
                          <RefreshCw className={`w-3 h-3 ${loadingAi ? 'animate-spin' : ''}`} />
                          Refazer Análise
                        </button>
                      </div>
                      
                      <div className="space-y-3 leading-relaxed text-slate-300">
                        {renderFormattedAdvice(aiAdvice)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
