const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');
const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(controllersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add import if not present
  if (!content.includes("import { hasRole }")) {
    content = content.replace(
      /(import.*from.*express.*;)/,
      "$1\nimport { hasRole } from '../middleware/auth';"
    );
  }
  
  // Replace all role checks
  content = content.replace(
    /if \(req\.user\?\.role !== 'admin'\)/g,
    "if (!hasRole(req.user, 'admin'))"
  );
  content = content.replace(
    /if \(req\.user\?\.role !== 'pco'\)/g,
    "if (!hasRole(req.user, 'pco'))"
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${file}`);
});

console.log('All controller files updated!');
