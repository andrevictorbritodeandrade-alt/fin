const fs = require('fs');
let code = fs.readFileSync('services/firebaseConfig.ts', 'utf8');

code = code.replace(/import \{ initializeFirestore, persistentLocalCache, persistentMultipleTabManager \} from "firebase\/firestore";/, 'import { initializeFirestore, memoryLocalCache } from "firebase/firestore";');

code = code.replace(/localCache: persistentLocalCache\(\{\s*tabManager: persistentMultipleTabManager\(\)\s*\}\)/s, 'localCache: memoryLocalCache()');

fs.writeFileSync('services/firebaseConfig.ts', code);
