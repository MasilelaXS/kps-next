#!/bin/bash
# Fix all role checks to support 'both' role

# Add import to all controller files
for file in src/controllers/*.ts; do
  if ! grep -q "import { hasRole }" "$file"; then
    # Add import after existing imports
    sed -i "/^import.*from.*express/a import { hasRole } from '../middleware/auth';" "$file"
  fi
  
  # Replace role checks
  sed -i "s/if (req\.user\?\.role !== 'admin')/if (!hasRole(req.user, 'admin'))/g" "$file"
  sed -i "s/if (req\.user\?\.role !== 'pco')/if (!hasRole(req.user, 'pco'))/g" "$file"
done

echo "Fixed all role checks in controllers"
