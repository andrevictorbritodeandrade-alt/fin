const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf8');

// Replace static paidAt: undefined
content = content.replace(/paidAt:\s*undefined,?/g, 'paidAt: null,');

// Replace conditional undefined
content = content.replace(/\? new Date\(\)\.toISOString\(\) : undefined/g, '? new Date().toISOString() : null');
content = content.replace(/\? 'Despesas Fixas' : undefined/g, "? 'Despesas Fixas' : null");

fs.writeFileSync('App.tsx', content);
console.log('Done');
