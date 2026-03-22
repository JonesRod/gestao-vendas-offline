const fs = require('fs');
let txt = fs.readFileSync('c:/Users/batat/.gemini/antigravity/scratch/gestao-offline/src/pages/Reports.tsx', 'utf8');
txt = txt.replace(/<table className="responsive-table"/g, '<table id="report-table" className="responsive-table"');
fs.writeFileSync('c:/Users/batat/.gemini/antigravity/scratch/gestao-offline/src/pages/Reports.tsx', txt);
