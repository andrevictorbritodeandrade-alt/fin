const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');
code = code.replace(/window\.dbg_msg = new Error\(\)\.stack\.split\("\\n"\)\[1\];/g, '');
fs.writeFileSync('App.tsx', code);
