const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/paid: month === 7,/g, 'paid: month === 7, userModifiedPaid: month === 7,');
code = code.replace(/paid: month === 7 \? true : e\.paid,/g, 'paid: month === 7 ? true : e.paid, userModifiedPaid: month === 7 ? true : e.userModifiedPaid,');

fs.writeFileSync('App.tsx', code);
