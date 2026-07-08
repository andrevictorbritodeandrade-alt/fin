const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/localStorage\.setItem\(([^,]+),\s*(.+?)\);/g, `try { localStorage.setItem($1, $2); } catch (e) { console.warn("LocalStorage Quota Exceeded:", e); }`);

fs.writeFileSync('App.tsx', code);
