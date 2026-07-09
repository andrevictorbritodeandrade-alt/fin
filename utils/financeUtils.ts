import { MonthData, Transaction, Goal, DebtSettlement } from '../types';
import { PAYMENT_SCHEDULE, INITIAL_ACCOUNTS, MONTH_NAMES } from '../constants';

// Helper to get local data key
export const getStorageKey = (year: number, month: number) => `financeData_${year}_${month}`;

export const getMonthName = (month: number) => MONTH_NAMES[month - 1];

export const formatCurrency = (val: number, compact: boolean = false) => {
    // Round to 2 decimal places to avoid floating point issues
    const roundedVal = Math.round(val * 100) / 100;
    const isWhole = roundedVal % 1 === 0;
    const numberFormatOptions: Intl.NumberFormatOptions = { 
        style: 'currency', 
        currency: 'BRL',
        minimumFractionDigits: isWhole ? 0 : 2,
        maximumFractionDigits: 2,
        notation: compact ? "compact" : "standard"
    };
    return new Intl.NumberFormat('pt-BR', numberFormatOptions).format(roundedVal);
};

// Calculates which installment corresponds to the current view date
function getInstallmentInfo(startYear: number, startMonth: number, total: number, targetYear: number, targetMonth: number) {
    // Calculate difference in months
    const diff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
    const current = diff + 1; // Installments start at 1

    // If current is less than 1 (starts in future) or greater than total (expired), return null
    if (current < 1 || current > total) return null;
    
    return { current, total };
}

// Generates data for ANY month based on configuration templates
export const generateMonthData = (year: number, month: number): MonthData => {
    // Determine reference month for salary (usually pays on prev month reference)
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }

    const refMonthName = getMonthName(month); // Salario é referente ao mês atual, mas recebido antes
    
    // Pattern: Salary day is based on the PAYMENT_SCHEDULE of the PREVIOUS month. 
    // Example: Viewing Feb (Month 2). prevMonth=1 (Jan). Schedule[1] = '-01-28'. Date = 2026-01-28.
    const salaryDaySuffix = PAYMENT_SCHEDULE[prevMonth] || '-28'; 
    const salaryDate = `${prevYear}${salaryDaySuffix}`;

    const isMay2026 = (year === 2026 && month === 5);
    const isBeforeJune2026 = (year < 2026) || (year === 2026 && month < 6);

    // Pattern: Mumbuca day is 15 of CURRENT month for months before June 2026, and 10 starting June 2026 (or May 2026).
    const mumbucaDay = (isBeforeJune2026 && !isMay2026) ? '15' : '10';
    const mumbucaDate = `${year}-${month.toString().padStart(2,'0')}-${mumbucaDay}`;
    
    // Check if it's the initial month (Jan 2026) for "Paid" logic
    const isJan2026 = (year === 2026 && month === 1);
    const isFeb2026 = (year === 2026 && month === 2);
    const isMar2026 = (year === 2026 && month === 3);
    const isApr2026 = (year === 2026 && month === 4);
    const isApr2026OrMay2026 = isApr2026 || isMay2026;

    let marcellySalaryDate = salaryDate;
    let marcellySalaryDesc = `SALARIO MARCELLY`;
    let andreSalaryDate = salaryDate;
    let andreSalaryDesc = `SALARIO ANDRE`;

    if (year === 2026 && month === 7) {
        marcellySalaryDesc = `SALÁRIO MARCELLY (Recebimento: 26/06)`;
        andreSalaryDate = `2026-07-01`;
        andreSalaryDesc = `SALÁRIO ANDRÉ (Recebimento: 01/07 - Estado)`;
    }

    // Base Incomes
    const newIncomes: Transaction[] = [
        { id: `inc_m_${year}_${month}`, description: marcellySalaryDesc, amount: 3436.22, paid: isJan2026 || isApr2026OrMay2026, date: marcellySalaryDate, dueDate: marcellySalaryDate, category: 'Salário' },
        { id: `inc_a_${year}_${month}`, description: andreSalaryDesc, amount: (year === 2026 && month >= 7) || (year > 2026) ? 3334.00 : 3436.22, paid: isJan2026 || isApr2026OrMay2026, date: andreSalaryDate, dueDate: andreSalaryDate, category: 'Salário' },
        { id: `inc_mum_m_${year}_${month}`, description: 'MUMBUCA MARCELLY', amount: 598.00, paid: isJan2026, date: mumbucaDate, category: 'Mumbuca' }
    ];

    if (isBeforeJune2026) {
        newIncomes.push(
            { id: `inc_mum_a_${year}_${month}`, description: 'MUMBUCA ANDRE', amount: 598.00, paid: isJan2026, date: mumbucaDate, category: 'Mumbuca' }
        );
    }

    // --- 13º SALÁRIO LOGIC ---
    if (month === 7) {
        const amount13 = 1718.11; 
        newIncomes.push(
            { id: `inc_13_1_m_${year}`, description: '1ª PARCELA 13º MARCELLY', amount: amount13, paid: year === 2026 ? true : false, date: `${prevYear}-06-26`, category: 'Salário' }
        );
        if (year !== 2026) {
            newIncomes.push(
                { id: `inc_13_1_a_${year}`, description: '1ª PARCELA 13º ANDRÉ', amount: amount13, paid: false, date: `${prevYear}-06-26`, category: 'Salário' }
            );
        }
    }

    // --- RESTITUIÇÃO IMPOSTO DE RENDA ---
    if (year === 2026 && month === 7) {
        newIncomes.push(
            { id: `inc_ir_a_${year}`, description: 'RESTITUIÇÃO IR ANDRÉ', amount: 343.49, paid: false, date: '2026-07-15', category: 'Outros' },
            { id: `inc_ir_m_${year}`, description: 'RESTITUIÇÃO IR MARCELLY', amount: 343.49, paid: false, date: '2026-07-15', category: 'Outros' }
        );
    }
    if (month === 1) {
        const amount13_2 = 1500.00; 
        newIncomes.push(
            { id: `inc_13_2_m_${year}`, description: '2ª PARCELA 13º MARCELLY', amount: amount13_2, paid: false, date: `${prevYear}-12-07`, category: 'Salário' },
            { id: `inc_13_2_a_${year}`, description: '2ª PARCELA 13º ANDRÉ', amount: amount13_2, paid: false, date: `${prevYear}-12-07`, category: 'Salário' }
        );
    }

    const newExpenses: Transaction[] = [];

    // List of items paid in Jan 2026
    const paidInJan2026 = ["ALUGUEL", "REMÉDIOS", "PSICÓLOGA", "APPAI", "VIVO", "CLARO", "MULTAS", "RENEGOCIAR", "PASSAGENS", "FACULDADE", "CIDADANIA", "GUARDA ROUPAS", "CELULAR", "CONSERTO", "INTERNET", "INTERMÉDICA", "FATURA"];
    
    // List of items paid in Mar 2026
    const paidInMar2026 = ["ALUGUEL", "APPAI", "FATURA DO CARTÃO DO ANDRÉ ITAÚ", "CELULAR DA MARCELLY", "LILI TORRES", "JADY"];
    
    // List of items paid in Apr 2026
    const paidInApr2026 = ["ALUGUEL", "APPAI DO ANDRÉ", "INTERNET DA CASA", "INTERMÉDICA DO ANDRÉ", "SEGURO DO CARRO", "GUARDA ROUPAS", "FACULDADE", "MALA DO ANDRÉ", "RENEGOCIAR CARREFOUR", "EMPRÉSTIMO", "CARTÃO DO ITAÚ DA MARCELLY", "CLARO DA MARCELLY", "MÃO DE OBRA", "REMÉDIO PARA CUPIM"];

    // 1. RECURRING/FIXED EXPENSES
    const cyclicalConfig = [
        { description: "ALUGUEL", amount: 1300.00, category: "Moradia", day: 1, group: 'MORADIA' },
        { description: "PSICÓLOGA DA MARCELLY", amount: 280.00, category: "Saúde", day: 10, group: 'MORADIA' }, 
        { description: "APPAI DA MARCELLY", amount: 110.00, category: "Saúde", day: 23, group: 'MARCIA BISPO' },
        { description: "APPAI DO ANDRÉ", amount: 129.50, category: "Saúde", day: 12, group: 'MARCIA BRITO' },
        { description: "CARTÃO DO ITAÚ DA MARCELLY", amount: 200.00, category: "Moradia", day: 24, group: 'MORADIA' },
        { description: "CARTÃO DO ITAÚ DO ANDRÉ", amount: 116.00, category: "Moradia", day: 24, group: 'MORADIA' },
        { description: "INTERNET DA CASA", amount: 125.00, category: "Moradia", day: 18, group: 'MORADIA' },
        { description: "INTERMÉDICA DO ANDRÉ", amount: 123.00, category: "Saúde", day: 12, group: 'MARCIA BRITO' },
        { description: "CONTA DA CLARO ANDRÉ", amount: 0, category: "Moradia", day: 5, group: 'MORADIA' },
        { description: "SEGURO DO CARRO", amount: 143.00, category: "Moradia", day: 20, group: 'MORADIA' },
        { description: "CONTA DA VIVO MARCELLY", amount: 66.60, category: "Moradia", day: 23, group: 'MORADIA' },
        { description: "CARTÃO DO IAGO", amount: 1819.22, category: "Iago", day: 7, group: 'IAGO (CARTÃO NUBANK)' },
        { description: "REMÉDIOS DO ANDRÉ", amount: 400.00, category: "Saúde", day: 10, group: 'MORADIA' }
    ];

    cyclicalConfig.forEach(c => {
        let finalAmount = c.amount;
        let isPaid = false;
        let isSuspended = false;
        let paidAtStr: string | undefined = undefined;
        
        if (isFeb2026 && (c.description.includes("CLARO ANDRÉ") || c.description.includes("VIVO ANDRÉ"))) {
            return; 
        }

        // Removal for Vivo André and Vivo Marcelly as requested (Mar 2026 onwards)
        const isVivoAndre = c.description.toUpperCase().includes("VIVO ANDRÉ") || c.description.toUpperCase().includes("VIVO ANDRE");
        const isVivoMarcelly = c.description.toUpperCase().includes("VIVO MARCELLY");
        
        if (year === 2026 && month >= 3 && (isVivoAndre || isVivoMarcelly)) {
            return; 
        }

        // Exclude Claro André starting June 2026
        const isClaroAndre = c.description.toUpperCase().includes("CLARO ANDRÉ") || c.description.toUpperCase().includes("CLARO ANDRE") || c.description.toUpperCase() === "CLARO ANDRÉ";
        if (year === 2026 && month >= 6 && isClaroAndre) {
            return;
        }

        // Exclude Seguro do Carro for June 2026 as user is paying late with late June/July funds
        const isSeguroCarro = c.description.toUpperCase() === "SEGURO DO CARRO";
        if (year === 2026 && month === 6 && isSeguroCarro) {
            return;
        }

        // Cartão do Itaú da Marcelly is set to 0.00 for June 2026 as requested (deixe essa conta só para o mês que vem, e esse mês deixe zerado)
        if (c.description.toUpperCase() === "CARTÃO DO ITAÚ DA MARCELLY" && year === 2026 && month === 6) {
            finalAmount = 0.00;
        }

        // Cartão do Itaú do André is always 100 reais starting June 2026
        if (c.description.toUpperCase().includes("CARTÃO DO ITAÚ DO ANDRÉ") || c.description.toUpperCase().includes("CARTAO DO ITAU DO ANDRE")) {
            if (year === 2026 && month === 7) {
                    finalAmount = 200.00;
                } else if (year === 2026 && month >= 6) {
                    finalAmount = 100.00;
                }
        }

        // Cartão do Iago is 430.00 only for July 2026 specifically
        if (c.description.toUpperCase() === "CARTÃO DO IAGO") {
            if (year === 2026 && month === 7) {
                finalAmount = 1204.00;
            }
        }

        // Remédios do André is adjusted to 170 reais starting June 2026 and marked as paid only in June 2026 (bought on May 27, 2026). In future months, it is unpaid/unchecked by default.
        if (c.description.toUpperCase().includes("REMÉDIOS DO ANDRÉ") || c.description.toUpperCase().includes("REMEDIOS DO ANDRE")) {
            if (year === 2026 && month === 6) {
                finalAmount = 170.00;
                isPaid = true;
                paidAtStr = "2026-05-27";
            } else if ((year === 2026 && month >= 7) || year > 2026) {
                finalAmount = 170.00;
                isPaid = false;
                paidAtStr = undefined;
            }
        }

        if (isJan2026) {
            if (c.description.includes("ITAÚ")) finalAmount = 56.40;
            if (paidInJan2026.some(p => c.description.toUpperCase().includes(p))) isPaid = true;
        }
        if (isFeb2026) {
            if (c.description.includes("ITAÚ")) finalAmount = 57.00;
        }
        if (isMar2026) {
            if (paidInMar2026.some(p => c.description.toUpperCase().includes(p))) isPaid = true;
        }
        if (year === 2026 && (month === 4 || month === 5)) {
            if (paidInApr2026.some(p => c.description.toUpperCase().includes(p))) isPaid = true;
        }

        const isFutureMonth = (year === 2026 && month >= 7) || (year > 2026);

        newExpenses.push({
            id: `exp_${year}_${month}_${c.description.replace(/\s/g, '')}`,
            description: c.description,
            amount: finalAmount,
            category: c.category,
            paid: isFutureMonth ? false : (isPaid || (c.amount === 0 && (month >= 4))), // Auto-pay zeroed items except for future months
            dueDate: `${year}-${month.toString().padStart(2,'0')}-${c.day.toString().padStart(2,'0')}`,
            group: c.group,
            isSuspended: isSuspended,
            paidAt: isFutureMonth ? undefined : paidAtStr
        });
    });

    // Consolidate avulsos below
    // 2. INSTALLMENT EXPENSES
    const finiteConfig = [
        { desc: "GUARDA ROUPAS", totalAmount: 914.48, cat: "Moradia", day: 12, installments: 5, sY: 2026, sM: 2, group: 'MARCIA BRITO' },
        { desc: "CELULAR DA MARCELLY", totalAmount: 4628.88, cat: "Outros", day: 10, installments: 12, sY: 2026, sM: 3, group: 'MARCIA BISPO' },
        { desc: "REFORMA DO SOFÁ DE CAXIAS", totalAmount: 575.00, cat: "Moradia", day: 12, installments: 5, sY: 2026, sM: 4, group: 'MARCIA BRITO' },
        { desc: "CONSERTO DO CARRO DE OUTUBRO", totalAmount: 1447.00, cat: "Transporte", day: 12, installments: 4, sY: 2025, sM: 11, group: 'MARCIA BRITO' },
        { desc: "FACULDADE DA MARCELLY", totalAmount: 2026.80, cat: "Educação", day: 12, installments: 10, sY: 2025, sM: 12, group: 'MARCIA BRITO' },
        { desc: "PASSAGENS AÉREAS JOBURG X CAPE TOWN", totalAmount: 1560.00, cat: "Lazer", day: 12, installments: 5, sY: 2026, sM: 3, group: 'MARCIA BRITO' },
        { desc: "PASSAGENS DE ONIBUS RIO x SP", totalAmount: 438.00, cat: "Transporte", day: 12, installments: 5, sY: 2026, sM: 3, group: 'MARCIA BRITO' },
        { desc: "MALA DO ANDRÉ", totalAmount: 179.00, cat: "Lazer", day: 12, installments: 3, sY: 2026, sM: 3, group: 'MARCIA BRITO' },
        { desc: "RENEGOCIAR CARREFOUR", totalAmount: 5000.00, cat: "Dívidas", day: 12, installments: 16, sY: 2025, sM: 12, group: 'MARCIA BRITO' },
        { desc: "EMPRÉSTIMO COM LILI", totalAmount: 4000.00, cat: "Dívidas", day: 4, installments: 5, sY: 2026, sM: 5, group: 'LILI TORRES' },
        { desc: "ESTADIA EM JOHANESBURGO", totalAmount: 1363.93, cat: "Lazer", day: 4, installments: 5, sY: 2026, sM: 3, group: 'LILI TORRES' },
        { desc: "ESTADIA EM CIDADE DO CABO", totalAmount: 1197.00, cat: "Lazer", day: 4, installments: 5, sY: 2026, sM: 3, group: 'LILI TORRES' },
        { desc: "ESTADIA DE VOLTA EM SAO PAULO", totalAmount: 358.20, cat: "Lazer", day: 4, installments: 4, sY: 2026, sM: 3, group: 'LILI TORRES' },
        { desc: "ESTADIA DE IDA EM SAO PAULO", totalAmount: 289.44, cat: "Lazer", day: 4, installments: 4, sY: 2026, sM: 3, group: 'LILI TORRES' },
        { desc: "PASSAGENS AÉREAS SP X JOBURG", totalAmount: 4038.96, cat: "Lazer", day: 4, installments: 8, sY: 2026, sM: 1, group: 'LILI TORRES' },
        { desc: "COMPRAS DA MARCELLY NA SHEIN", totalAmount: 236.00, cat: "Outros", day: 4, installments: 2, sY: 2026, sM: 6, group: 'LILI TORRES' },
        { desc: "CIDADANIA PORTUGUESA", totalAmount: 5180.00, cat: "Dívidas", day: 12, installments: 37, sY: 2024, sM: 11, group: 'REBECCA BRITO' },
        { desc: "PASSEIO DE SAFARI", totalAmount: 3429.60, cat: "Lazer", day: 10, installments: 6, sY: 2026, sM: 3, group: 'JADY' },
        { desc: "COMPRA DE TÊNIS", totalAmount: 619.98, cat: "Outros", day: 10, installments: 2, sY: 2026, sM: 6, group: 'JADY' },
        { desc: "COMPRA DE MAQUIAGEM", totalAmount: 232.00, cat: "Outros", day: 10, installments: 2, sY: 2026, sM: 6, group: 'JADY' },
        { desc: "EMPRÉSTIMO COM MARCIA BISPO", totalAmount: 400.00, cat: "Dívidas", day: 15, installments: 4, sY: 2026, sM: 4, group: 'MARCIA BISPO' },
        { desc: "REMÉDIO PARA CUPIM", totalAmount: 37.00, cat: "Saúde", day: 28, installments: 1, sY: 2026, sM: 4, group: 'MARCIA BRITO' },
        { desc: "MÃO DE OBRA DO DAVI", totalAmount: 372.82, cat: "Moradia", day: 12, installments: 3, sY: 2026, sM: 5, group: 'MARCIA BRITO' },
        { desc: "KR AUTOPEÇAS", totalAmount: 291.00, cat: "Transporte", day: 12, installments: 7, sY: 2026, sM: 5, group: 'MARCIA BRITO' },
        { desc: "FILHÃO AUTOPEÇAS", totalAmount: 120.00, cat: "Transporte", day: 12, installments: 3, sY: 2026, sM: 5, group: 'MARCIA BRITO' },
        { desc: "CABESOM", totalAmount: 179.00, cat: "Outros", day: 28, installments: 2, sY: 2026, sM: 5, group: 'MARCIA BRITO' },
        { desc: "REMÉDIOS (MARCIA BRITO)", totalAmount: 246.09, cat: "Saúde", day: 28, installments: 3, sY: 2026, sM: 5, group: 'MARCIA BRITO' },
        { desc: "ALINHAMENTO DO CARRO", totalAmount: 330.00, cat: "Transporte", day: 12, installments: 2, sY: 2026, sM: 7, group: 'MARCIA BRITO' },
        { desc: "EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO", totalAmount: 1944.00, cat: "Dívidas", day: 20, installments: 4, sY: 2026, sM: 6, group: 'MARCIA BRITO' },
        { desc: "PASSAGENS AÉREAS (IAGO)", totalAmount: 1394.00, cat: "Lazer", day: 7, installments: 6, sY: 2026, sM: 8, group: 'IAGO (CARTÃO NUBANK)' }
    ];


    finiteConfig.forEach(f => {
        // Pausing Empréstimo com Marcia Bispo for June 2026 explicitly and resuming next month
        if (f.desc === "EMPRÉSTIMO COM MARCIA BISPO" && year === 2026 && month === 6) {
            return;
        }

        let startYearOverride = f.sY;
        let startMonthOverride = f.sM;
        if (f.desc === "EMPRÉSTIMO COM MARCIA BISPO" && (year > 2026 || (year === 2026 && month > 6))) {
            startMonthOverride = f.sM + 1; // resumes in July 2026 as installment 3/4
        }

        const inst = getInstallmentInfo(startYearOverride, startMonthOverride, f.installments, year, month);
        if (inst) {
            let isPaid = false;
            if (isJan2026) {
                if (paidInJan2026.some(p => f.desc.toUpperCase().includes(p))) isPaid = true;
            }
            if (isMar2026) {
                if (paidInMar2026.some(p => f.desc.toUpperCase().includes(p))) isPaid = true;
            }
            if (year === 2026 && month === 4) {
                if (paidInApr2026.some(p => f.desc.toUpperCase().includes(p))) isPaid = true;
            }
            const installmentAmount = f.totalAmount / f.installments;
            
            newExpenses.push({
                id: `fin_${f.desc.replace(/\s/g,'')}_${inst.current}`,
                description: f.desc, 
                amount: parseFloat(installmentAmount.toFixed(2)),
                category: f.cat,
                paid: isPaid,
                dueDate: `${year}-${month.toString().padStart(2,'0')}-${f.day.toString().padStart(2,'0')}`,
                installments: inst,
                group: f.group
            });
        }
    });

    const newAvulsosItems: Transaction[] = [];
    if (year === 2026 && month === 4) {
        newAvulsosItems.push(
            { id: `avulso_apr_proprio`, description: 'Compras (Dinheiro Próprio)', amount: 242, paid: true, category: 'Alimentação', dueDate: '2026-04-01', group: 'COMPRAS ABRIL' }
        );
    }
    if (year === 2026 && month === 5) {
        // Compras IAGO moved to expenses as requested
        newAvulsosItems.push(
            // Moved from April as requested (uses May salary)
            { id: `avulso_combustivel_may`, description: "COMBUSTÍVEL (30/04)", amount: 50.00, category: "Transporte", paid: true, dueDate: "2026-04-30", date: "2026-04-30" },
            { id: `avulso_mercado_may`, description: "MERCADO (29/04)", amount: 187.28, category: "Alimentação", paid: true, dueDate: "2026-04-29", date: "2026-04-29" },
            { id: `avulso_agua_may`, description: "COMPRA DA ÁGUA (29/04)", amount: 10.00, category: "Alimentação", paid: true, dueDate: "2026-04-29", date: "2026-04-29" },
            { id: `avulso_pedagio_may`, description: "PEDÁGIO (05/05)", amount: 6.60, category: "Transporte", paid: true, dueDate: "2026-05-05", date: "2026-05-05" },
            { id: `avulso_mcd_may`, description: "MC DONALDS (04/05)", amount: 9.80, category: "Lazer", paid: true, dueDate: "2026-05-04", date: "2026-05-04" },
            { id: `avulso_compra_4may_1`, description: "COMPRA AVULSA (04/05)", amount: 21.99, category: "Outros", paid: true, dueDate: "2026-05-04", date: "2026-05-04" },
            { id: `avulso_compra_4may_2`, description: "COMPRA AVULSA (04/05)", amount: 21.00, category: "Outros", paid: true, dueDate: "2026-05-04", date: "2026-05-04" },
            { id: `avulso_compra_30apr`, description: "COMPRA AVULSA (30/04)", amount: 20.00, category: "Outros", paid: true, dueDate: "2026-04-30", date: "2026-04-30" },
            { id: `avulso_compra_29apr`, description: "COMPRA AVULSA (29/04)", amount: 10.00, category: "Outros", paid: true, dueDate: "2026-04-29", date: "2026-04-29" }
        );
    }
    
    if (year === 2026 && month >= 6) {
        // Iago expenses replaced by Cartão do Iago in cyclicalConfig
    }

    const defaultSettlements: DebtSettlement[] = [
        { id: 'set_nubank', description: 'Acordo Nubank (À Vista)', amount: 700, priority: 1, isPaid: false, notes: 'Pagamento via PIX' },
        { id: 'set_itau_marcelly', description: 'Acordo Itaú Marcelly (À Vista)', amount: 400, priority: 2, isPaid: false, notes: 'Pagamento via PIX' }
    ];

    const customAccounts = INITIAL_ACCOUNTS.map(acc => {
        if (acc.id === 'acc_main') {
            return { ...acc, name: 'Santander', balance: isMay2026 ? 22.28 : acc.balance };
        }
        return acc;
    });

    return {
        incomes: newIncomes,
        expenses: newExpenses,
        shoppingItems: [],
        avulsosItems: newAvulsosItems,
        goals: [], // Goals removed as requested
        bankAccounts: customAccounts,
        debtSettlements: defaultSettlements,
        updatedAt: Date.now()
    };
};