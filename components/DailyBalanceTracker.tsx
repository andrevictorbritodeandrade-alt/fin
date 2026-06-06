import React, { useState } from 'react';
import { DailyBalanceLog } from '../types';
import { Calendar, DollarSign, Plus, Trash2, Edit2, TrendingUp, Sparkles, Building2, ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/financeUtils';

interface DailyBalanceTrackerProps {
    dailyBalances: DailyBalanceLog[];
    onUpdateBalances: (balances: DailyBalanceLog[]) => void;
}

const DailyBalanceTracker: React.FC<DailyBalanceTrackerProps> = ({ dailyBalances = [], onUpdateBalances }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    
    // Form States
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [santander, setSantander] = useState<string>('');
    const [inter, setInter] = useState<string>('');
    const [sofisa, setSofisa] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    
    // Quick Reset
    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setSantander('');
        setInter('');
        setSofisa('');
        setNotes('');
        setEditingLogId(null);
        setIsFormOpen(false);
    };

    const handleEdit = (log: DailyBalanceLog) => {
        setEditingLogId(log.id);
        setDate(log.date);
        setSantander(log.santander.toString());
        setInter(log.inter.toString());
        setSofisa(log.sofisa.toString());
        setNotes(log.notes || '');
        setIsFormOpen(true);
    };

    const handleDelete = (id: string) => {
        const remaining = dailyBalances.filter(log => log.id !== id);
        onUpdateBalances(remaining);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const numericSantander = parseFloat(santander) || 0;
        const numericInter = parseFloat(inter) || 0;
        const numericSofisa = parseFloat(sofisa) || 0;

        const newLog: DailyBalanceLog = {
            id: editingLogId || `db_${Date.now()}`,
            date,
            santander: Math.round(numericSantander * 100) / 100,
            inter: Math.round(numericInter * 100) / 100,
            sofisa: Math.round(numericSofisa * 100) / 100,
            notes: notes.trim() || undefined
        };

        let updated: DailyBalanceLog[];
        if (editingLogId) {
            updated = dailyBalances.map(log => log.id === editingLogId ? newLog : log);
        } else {
            // Avoid duplicates for the same date by overwriting or filtering
            const filtered = dailyBalances.filter(log => log.date !== date);
            updated = [...filtered, newLog];
        }

        // Sort by date descending
        updated.sort((a, b) => b.date.localeCompare(a.date));
        
        onUpdateBalances(updated);
        resetForm();
    };

    const formatDateBrazilian = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        if (!year || !month || !day) return dateStr;
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${day} de ${months[parseInt(month) - 1]}`;
    };

    // Calculate details
    const sortedBalances = [...dailyBalances].sort((a, b) => b.date.localeCompare(a.date));
    const latestBalance = sortedBalances[0];

    return (
        <div className="bg-white/40 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-4 lg:p-8 border border-white/60 shadow-xl shadow-slate-200/40 flex flex-col gap-6" id="daily-balance-tracker-widget">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-2xl shadow-md">
                        <TrendingUp size={22} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-base lg:text-lg font-black text-slate-800 tracking-tight">Saldo Palpável Diário</h2>
                        <span className="text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-widest">
                            Acompanhamento do Dinheiro Real em Conta por Dia
                        </span>
                    </div>
                </div>
                
                <button
                    onClick={() => {
                        resetForm();
                        setIsFormOpen(!isFormOpen);
                    }}
                    className="self-start sm:self-auto px-4 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Plus size={16} strokeWidth={3} />
                    <span>Lançar Saldo Real</span>
                </button>
            </div>

            {/* Form */}
            {isFormOpen && (
                <form onSubmit={handleSubmit} className="bg-white/90 border border-slate-100 shadow-xl rounded-2xl p-5 flex flex-col gap-4 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                            {editingLogId ? 'Editar Saldo em Conta' : 'Lançar Novo Balanço Diário'}
                        </h3>
                        <button type="button" onClick={resetForm} className="text-xs font-black text-slate-400 hover:text-slate-600">
                            Cancelar
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400">Data de Referência</label>
                            <input 
                                type="date" 
                                required
                                value={date} 
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-black text-slate-700 outline-none focus:border-teal-500 transition-colors"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase text-red-600 flex items-center gap-1">
                                <Building2 size={10} /> Santander (Real)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="0,00"
                                    required
                                    value={santander} 
                                    onChange={(e) => setSantander(e.target.value)}
                                    className="bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs font-black text-slate-700 w-full outline-none focus:border-red-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-1">
                                <Building2 size={10} /> Inter (Real)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="0,00"
                                    value={inter} 
                                    onChange={(e) => setInter(e.target.value)}
                                    className="bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs font-black text-slate-700 w-full outline-none focus:border-orange-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                <Building2 size={10} /> Sofisa (Contas Fixas Reservadas)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="4351,00"
                                    value={sofisa} 
                                    onChange={(e) => setSofisa(e.target.value)}
                                    className="bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs font-black text-slate-700 w-full outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                            <MessageSquare size={10} /> Notas / Observações
                        </label>
                        <input 
                            type="text" 
                            placeholder="Ex: 'Valor palpável no bolso para alimentos', 'Recebemos as sobras', 'PIX caiu real'"
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-teal-500 transition-colors"
                        />
                    </div>

                    <button 
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all text-center mt-1"
                    >
                        {editingLogId ? 'Salvar Edições' : 'Confirmar Registro Diário'}
                    </button>
                </form>
            )}

            {/* Balances Timeline */}
            {sortedBalances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 bg-white/50 border border-dashed border-slate-200 rounded-2xl">
                    <Calendar size={32} className="opacity-20 mb-2" />
                    <span className="text-xs font-black">Nenhum registro lançado ainda neste ciclo.</span>
                    <span className="text-[10px] font-bold opacity-60 mt-1">Clique em 'Lançar Saldo Real' para começar.</span>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {/* Active Today / Latest highlight block */}
                    {latestBalance && (
                        <div className="bg-gradient-to-br from-slate-900 to-slate-850 text-white rounded-2xl p-5 relative overflow-hidden shadow-xl shadow-slate-900/10 border border-slate-800">
                            <div className="absolute top-[-10%] right-[-10%] opacity-10">
                                <Sparkles size={100} />
                            </div>
                            <div className="relative z-10 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Último Saldo Informado</span>
                                    </div>
                                    <span className="text-xs font-black uppercase text-slate-300">
                                        {formatDateBrazilian(latestBalance.date)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-baseline mt-1">
                                    <span className="text-3xl font-black tracking-tight select-all">
                                        {formatCurrency(latestBalance.santander + latestBalance.inter + latestBalance.sofisa)}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">Total Palpável</span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 mt-1 text-center">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase text-slate-405">Santander</span>
                                        <span className="text-xs font-extrabold text-white">{formatCurrency(latestBalance.santander)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase text-slate-405">Inter</span>
                                        <span className="text-xs font-extrabold text-white">{formatCurrency(latestBalance.inter)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase text-slate-405 flex items-center justify-center gap-1">
                                            Sofisa <span className="text-[8px] font-bold text-emerald-400 opacity-90">(Contas Fixas)</span>
                                        </span>
                                        <span className="text-xs font-extrabold text-white">{formatCurrency(latestBalance.sofisa)}</span>
                                    </div>
                                </div>
                                {latestBalance.notes && (
                                    <div className="bg-white/5 border border-white/5 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-350 italic mt-1 leading-relaxed">
                                        " {latestBalance.notes} "
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Historic Timeline List */}
                    <div className="flex flex-col gap-3 mt-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Histórico de Controle Real</span>
                        <div className="max-h-[300px] overflow-y-auto pr-1 flex flex-col gap-2.5">
                            {sortedBalances.map((log) => {
                                const total = log.santander + log.inter + log.sofisa;
                                return (
                                    <div 
                                        key={log.id} 
                                        className="bg-white border border-slate-50 hover:border-slate-100 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all relative group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex flex-col items-center justify-center font-black text-center shrink-0">
                                                <Calendar size={14} className="opacity-70 mb-0.5" />
                                                <span className="text-[9px] leading-none uppercase tracking-tighter">
                                                    {log.date.split('-')[2]}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-extrabold text-slate-800 uppercase tracking-tighter shrink-0">
                                                        {formatDateBrazilian(log.date)}
                                                    </span>
                                                    <span className="text-xs font-black text-emerald-600">
                                                        {formatCurrency(total)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 text-[10px] font-black text-slate-400">
                                                    <span className="text-red-500">SAN: R$ {log.santander.toFixed(2)}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="text-orange-500">INT: R$ {log.inter.toFixed(2)}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="text-emerald-600">SOF (Contas Fixas): R$ {log.sofisa.toFixed(2)}</span>
                                                </div>
                                                {log.notes && (
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md mt-1 italic block max-w-md truncate">
                                                        {log.notes}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-all ml-auto self-end sm:self-auto shrink-0 bg-white sm:bg-transparent rounded-lg p-1">
                                            <button 
                                                onClick={() => handleEdit(log)}
                                                className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-450 hover:text-slate-700 transition-colors"
                                                title="Editar registro"
                                            >
                                                <Edit2 size={13} strokeWidth={2.5} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(log.id)}
                                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                                                title="Excluir registro"
                                            >
                                                <Trash2 size={13} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyBalanceTracker;
