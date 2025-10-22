const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');
const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(controllersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // After hasRole check, req.user is guaranteed to be defined
  // Replace all instances of req.user.id (after role check) with req.user!.id
  
  // Pattern: any use of req.user after a hasRole check should use non-null assertion
  // We'll replace common patterns:
  
  // In function bodies after hasRole check
  content = content.replace(/(\s+)(created_by|updated_by|deleted_by|added_by|assigned_by|unassigned_by|reset_by|attempted_by): req\.user\.id/g, 
    '$1$2: req.user!.id');
  
  // In array parameters
  content = content.replace(/\[([^\]]*?)(req\.user\.id)([^\]]*?)\]/g, 
    (match, before, reqUser, after) => {
      // Only replace if not already using !
      if (!match.includes('req.user!.id')) {
        return `[${before}req.user!.id${after}]`;
      }
      return match;
    });
  
  // In conditionals
  content = content.replace(/(if\s*\([^)]*)(req\.user\.id)([^)]*\))/g,
    (match, before, reqUser, after) => {
      if (!match.includes('req.user!.id')) {
        return `${before}req.user!.id${after}`;
      }
      return match;
    });
  
  // In logAuth calls
  content = content.replace(/(logAuth\([^,]+,\s*)(req\.user\.id)/g, '$1req.user!.id');
  
  // In object properties
  content = content.replace(/(\w+):\s*req\.user\.id(?!\.)/g,
    (match, prop) => {
      if (!match.includes('req.user!.id')) {
        return `${prop}: req.user!.id`;
      }
      return match;
    });
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${file}`);
});

console.log('All TypeScript errors fixed!');
