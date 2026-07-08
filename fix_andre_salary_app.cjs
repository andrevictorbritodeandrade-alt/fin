const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/3100\.00/g, '3334.00');

fs.writeFileSync('App.tsx', code);
