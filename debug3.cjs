const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/const \[syncStatus, setSyncStatus\] = useState<'online' \| 'offline' \| 'syncing'>\('offline'\);/, `const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'syncing'>('offline');\n    const [debugMsg, setDebugMsg] = useState('');`);

code = code.replace(/if \(hasChanged\) \{\n\s*\/\/ Wait to prevent immediate loop issues, just in case/g, `if (hasChanged) {\n            console.log("hasChanged is true! DebugMsg:", window.dbg_msg);\n            setDebugMsg(window.dbg_msg);\n            // Wait to prevent immediate loop issues, just in case`);

code = code.replace(/hasChanged = true; console\.log\("hasChanged at line:", new Error\(\)\.stack\.split\("\\n"\)\[1\]\);/g, 'hasChanged = true; window.dbg_msg = new Error().stack.split("\\n")[1];');

// And add debugMsg to rendering
code = code.replace(/<div className="flex flex-col flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">/, `<div className="flex flex-col flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full"><div style={{color: 'red', fontSize: '20px', background: 'white'}}>{debugMsg}</div>`);

fs.writeFileSync('App.tsx', code);
