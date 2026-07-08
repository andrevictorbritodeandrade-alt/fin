const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
    /\/\/ 2\. Cartão do Itaú do André is always 100 reais\n\s*data\.expenses = data\.expenses\.map\(e => \{\n\s*const desc = e\.description\.toUpperCase\(\);\n\s*if \(desc\.includes\("CARTÃO DO ITAÚ DO ANDRÉ"\) \|\| desc\.includes\("CARTAO DO ITAU DO ANDRE"\)\) \{\n\s*return \{ \.\.\.e, amount: 100\.00 \};\n\s*\}\n\s*return e;\n\s*\}\);/,
    `// 2. Cartão do Itaú do André is 100 reais (but 200 in July 2026)
            data.expenses = data.expenses.map(e => {
                const desc = e.description.toUpperCase();
                if (desc.includes("CARTÃO DO ITAÚ DO ANDRÉ") || desc.includes("CARTAO DO ITAU DO ANDRE")) {
                    return { ...e, amount: (year === 2026 && month === 7) ? 200.00 : 100.00 };
                }
                return e;
            });`
);

fs.writeFileSync('App.tsx', code);
