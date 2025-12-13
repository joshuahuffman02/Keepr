#!/bin/bash

# Find all module files that import PrismaService directly
modules=$(grep -l "import.*PrismaService.*from.*prisma.service" platform/apps/api/src/**/*.module.ts 2>/dev/null)

for file in $modules; do
    echo "Fixing $file..."

    # Check if file already imports PrismaModule
    if grep -q "import.*PrismaModule" "$file"; then
        echo "  Already imports PrismaModule, skipping import change"
    else
        # Replace PrismaService import with PrismaModule import
        sed -i.bak "s|import { PrismaService } from|import { PrismaModule } from|g" "$file"
        sed -i.bak "s|from '../prisma/prisma.service'|from '../prisma/prisma.module'|g" "$file"
        sed -i.bak "s|from './prisma/prisma.service'|from './prisma/prisma.module'|g" "$file"
        sed -i.bak "s|from '../../prisma/prisma.service'|from '../../prisma/prisma.module'|g" "$file"
    fi

    # Remove PrismaService from providers array
    # This is complex, so we'll do it manually for now
    echo "  Need to manually remove PrismaService from providers and add PrismaModule to imports"
done

echo "Done! Review the changes before committing."
