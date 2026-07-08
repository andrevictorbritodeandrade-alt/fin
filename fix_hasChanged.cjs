const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const replacement = `// Clean up duplicates if any were created by previous bug
        const uniqueExpenses = [];
        const seenDescriptions = new Set();
        newData.expenses.forEach(e => {
            const desc = e.description.toUpperCase();
            
            // Map bad names to standard names
            let newDesc = e.description;
            if (desc === 'ALUGUEL DA CASA') newDesc = 'ALUGUEL';
            if (desc === 'CARTÃO DO INTER') newDesc = 'CARTÃO DO INTER DO ANDRÉ';

            const standardDesc = newDesc.toUpperCase();

            if (seenDescriptions.has(standardDesc) && (standardDesc.includes('CARTÃO DO INTER') || standardDesc.includes('CARTÃO DO ITAÚ DO ANDRÉ') || standardDesc.includes('ALUGUEL'))) {
                // skip duplicate
                hasChanged = true;
            } else {
                seenDescriptions.add(standardDesc);
                uniqueExpenses.push({...e, description: newDesc});
                if (e.description !== newDesc) hasChanged = true;
            }
        });
        newData.expenses = uniqueExpenses;`;

code = code.replace(/\/\/ Clean up duplicates if any were created by previous bug.*?newData\.expenses = uniqueExpenses;/s, replacement);

// And fix the debugMsg
code = code.replace(/if \(hasChanged\) \{\n\s*console\.log\("hasChanged is true! DebugMsg:", window\.dbg_msg\);\n\s*setDebugMsg\(window\.dbg_msg\);/g, 'if (hasChanged) {\n            ');

fs.writeFileSync('App.tsx', code);
