import React, { useState } from 'react';
import { Menu, ChevronLeft, ChevronRight, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../utils/financeUtils';

interface HeaderProps {
    month: number;
    year: number;
    balance: number;
    bankReserves: { santander: number; inter: number; sofisa: number };
    setBankReserves: (reserves: { santander: number; inter: number; sofisa: number }) => void;
    checkInDate: string | null;
    onMonthChange: (diff: number) => void;
    onSync: () => void;
    syncStatus: 'offline' | 'syncing' | 'online';
}

const Header: React.FC<HeaderProps> = ({ 
    month, year, balance, checkInDate, onMonthChange, onSync, syncStatus, bankReserves, setBankReserves
}) => {
    const [showBalance] = useState(true);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const isPositive = balance >= 0;
    
    // Dynamic Greeting
    const hour = new Date().getHours();
    let greeting = "Boa noite";
    if (hour >= 5 && hour < 12) greeting = "Bom dia";
    else if (hour >= 12 && hour < 18) greeting = "Boa tarde";

    // Formatted Date
    const today = new Date();
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
    }).format(today);
    
    // Modern gradients for balance
    const balanceGradient = isPositive 
        ? 'bg-gradient-to-r from-emerald-700 to-teal-600' 
        : 'bg-gradient-to-r from-rose-700 to-pink-600';

    return (
        <header className="sticky top-0 z-40 bg-gradient-to-b from-teal-600 via-teal-500/30 to-[#f0fdf4] backdrop-blur-lg pb-6 pt-4 rounded-b-[2.5rem] border-b border-emerald-900/10">
            {/* Header & Title */}
            <div className="flex flex-col items-center pt-2 pb-4">
                <h1 className="text-4xl lg:text-5xl font-black text-emerald-950 tracking-tighter drop-shadow-sm uppercase">
                    FINANÇAS DA FAMÍLIA
                </h1>
            </div>

            {/* Greeting & Action Buttons Row */}
            <div className="flex justify-between items-center px-6 mb-4">
                <div className="flex flex-col">
                    <span className="text-base lg:text-lg font-black text-emerald-950 uppercase tracking-[0.1em]">{greeting}, Família!</span>
                    <span className="text-xs lg:text-sm font-bold text-emerald-900/80 uppercase tracking-wide mt-0.5">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onSync}
                        className={`p-1.5 rounded-lg transition-all border border-emerald-900/10 shadow-lg ${
                            syncStatus === 'online' ? 'bg-emerald-900 text-white' :
                            syncStatus === 'syncing' ? 'bg-blue-800 text-white' : 'bg-white/50 text-emerald-900'
                        }`}
                    >
                        <RefreshCw size={16} strokeWidth={4} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Month Selector Row */}
            <div className="flex justify-center items-center px-5 mb-4">
                <div className="flex items-center gap-4 bg-emerald-900/10 p-2 rounded-2xl border border-emerald-900/10 backdrop-blur-md shadow-inner">
                    <button onClick={() => onMonthChange(-1)} className="p-2 rounded-xl hover:bg-emerald-900/20 text-emerald-950 transition-all">
                        <ChevronLeft size={20} strokeWidth={4} />
                    </button>
                    <span className="text-lg font-black w-40 text-center text-emerald-950 uppercase tracking-widest">
                        {monthNames[month - 1]} <span className="opacity-60">{year}</span>
                    </span>
                    <button onClick={() => onMonthChange(1)} className="p-2 rounded-xl hover:bg-emerald-900/20 text-emerald-950 transition-all">
                        <ChevronRight size={20} strokeWidth={4} />
                    </button>
                </div>
            </div>

            {/* Hero: Banks Reserves */}
            <div className="flex flex-col items-center justify-center mt-1 px-6">
                <div className="flex items-center gap-2 mb-0.5">
                     {checkInDate && (
                         <span className="text-[10px] font-black text-emerald-900 bg-emerald-400 px-2 py-0.5 rounded-full shadow-sm uppercase">
                            VALE: {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(checkInDate))}
                         </span>
                    )}
                </div>
                {/* Bank Reserves */}
                <div className="grid grid-cols-3 gap-1.5 lg:gap-3 w-full mt-2">
                     <div className="bg-red-600 rounded-xl p-1.5 lg:p-3 text-white shadow-md text-center overflow-hidden">
                         <div className="text-[9px] lg:text-[11px] font-black uppercase text-white/70 truncate">Santander</div>
                         <div className="flex justify-center items-center">
                            <span className="text-[10px] lg:text-sm font-black text-white/80">R$</span>
                             <input 
                                type="number" 
                                value={parseFloat(bankReserves.santander.toFixed(2))}
                                onChange={(e) => setBankReserves({...bankReserves, santander: Math.round(parseFloat(e.target.value) * 100) / 100 || 0})}
                                className="bg-transparent text-sm lg:text-2xl font-black w-full text-center outline-none"
                            />
                         </div>
                     </div>
                     <div className="bg-orange-500 rounded-xl p-1.5 lg:p-3 text-white shadow-md text-center overflow-hidden flex flex-col justify-between">
                         <div>
                             <div className="text-[9px] lg:text-[11px] font-black uppercase text-white/70 truncate">Inter</div>
                             <div className="flex justify-center items-center">
                                <span className="text-[10px] lg:text-sm font-black text-white/80">R$</span>
                                 <input 
                                    type="number" 
                                    value={parseFloat(bankReserves.inter.toFixed(2))}
                                    onChange={(e) => setBankReserves({...bankReserves, inter: Math.round(parseFloat(e.target.value) * 100) / 100 || 0})}
                                    className="bg-transparent text-sm lg:text-2xl font-black w-full text-center outline-none"
                                />
                             </div>
                         </div>
                         {bankReserves.inter > 0 && (
                             <div className="text-[7.5px] lg:text-[9px] font-black uppercase tracking-tight text-orange-100/95 leading-none mt-1" title="Poupança para viagem • Não rende • Isenta de Impostos e Tributação">
                                 🏖️ Poupança Viagem
                             </div>
                         )}
                     </div>
                     <div className="bg-emerald-600 rounded-xl p-1.5 lg:p-3 text-white shadow-md text-center overflow-hidden">
                         <div className="text-[9px] lg:text-[11px] font-black uppercase text-white/70 truncate" title="Sofisa (Contas Fixas)">Sofisa (Ct. Fixas)</div>
                         <div className="flex justify-center items-center">
                            <span className="text-[10px] lg:text-sm font-black text-white/80">R$</span>
                             <input 
                                type="number" 
                                value={parseFloat(bankReserves.sofisa.toFixed(2))}
                                onChange={(e) => setBankReserves({...bankReserves, sofisa: Math.round(parseFloat(e.target.value) * 100) / 100 || 0})}
                                className="bg-transparent text-sm lg:text-2xl font-black w-full text-center outline-none"
                            />
                         </div>
                     </div>
                 </div>

            </div>
        </header>
    );
};

export default Header;