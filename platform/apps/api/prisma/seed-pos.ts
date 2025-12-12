import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

async function main() {
    // 1. Get the first campground
    const campground = await prisma.campground.findFirst();
    if (!campground) {
        console.error('No campground found. Please create one first.');
        process.exit(1);
    }
    console.log(`Seeding data for campground: ${campground.name} (${campground.id})`);

    // 2. Create Categories
    const categories = [
        { name: 'Essentials', sortOrder: 0 },
        { name: 'Merch', sortOrder: 1 },
        { name: 'Food & Drink', sortOrder: 2 },
    ];

    for (const cat of categories) {
        await prisma.productCategory.upsert({
            where: {
                campgroundId_name: {
                    campgroundId: campground.id,
                    name: cat.name
                }
            },
            update: {},
            create: {
                name: cat.name,
                sortOrder: cat.sortOrder,
                campgroundId: campground.id,
            },
        });
    }
    console.log('Categories seeded.');

    // 3. Get Categories to link products
    const dbCategories = await prisma.productCategory.findMany({
        where: { campgroundId: campground.id }
    });

    const essentials = dbCategories.find(c => c.name === 'Essentials');
    const merch = dbCategories.find(c => c.name === 'Merch');
    const food = dbCategories.find(c => c.name === 'Food & Drink');

    // 4. Create Products
    const products = [
        {
            name: 'Firewood Bundle',
            description: 'Kiln-dried hardwood, perfect for campfires.',
            priceCents: 800,
            categoryId: essentials?.id,
            stock: 50,
            imageUrl: 'https://images.unsplash.com/photo-1595586868822-0437435272a0?auto=format&fit=crop&w=800&q=80'
        },
        {
            name: 'Bag of Ice (10lb)',
            description: 'Cubed ice for your cooler.',
            priceCents: 400,
            categoryId: essentials?.id,
            stock: 100,
            imageUrl: 'https://images.unsplash.com/photo-1599639668353-8d2645f5a2a8?auto=format&fit=crop&w=800&q=80'
        },
        {
            name: 'S\'mores Kit',
            description: 'Graham crackers, marshmallows, and chocolate bars. Serves 4.',
            priceCents: 1200,
            categoryId: food?.id,
            stock: 25,
            imageUrl: 'https://images.unsplash.com/photo-1630517726476-c43916212458?auto=format&fit=crop&w=800&q=80'
        },
        {
            name: 'Campground T-Shirt',
            description: '100% Cotton, available in S-XL.',
            priceCents: 2500,
            categoryId: merch?.id,
            stock: 40,
            imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80'
        },
        {
            name: 'Bug Spray',
            description: 'Keep the mosquitoes away.',
            priceCents: 950,
            categoryId: essentials?.id,
            stock: 15,
            imageUrl: 'https://images.unsplash.com/photo-1623944893529-5b721955e6c3?auto=format&fit=crop&w=800&q=80'
        },
        {
            name: 'Bottled Water',
            description: 'Cold spring water.',
            priceCents: 200,
            categoryId: food?.id,
            stock: 200,
            imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80'
        }
    ];

    for (const p of products) {
        if (!p.categoryId) continue;
        await prisma.product.create({
            data: {
                name: p.name,
                description: p.description,
                priceCents: p.priceCents,
                categoryId: p.categoryId,
                campgroundId: campground.id,
                stockQty: p.stock,
                imageUrl: p.imageUrl,
                isActive: true
            }
        });
    }
    console.log('Products seeded.');

    // 5. Create Site Class & Site
    const siteClass = await prisma.siteClass.create({
        data: {
            campgroundId: campground.id,
            name: 'Standard RV',
            siteType: 'rv',
            maxOccupancy: 6,
            defaultRate: 5000
        }
    });

    const site = await prisma.site.create({
        data: {
            campgroundId: campground.id,
            siteClassId: siteClass.id,
            name: 'A101',
            siteNumber: 'A101',
            siteType: 'rv',
            maxOccupancy: 6
        }
    });
    console.log('Site A101 created.');

    // 6. Create Guest & Reservation
    const guest = await prisma.guest.create({
        data: {
            primaryFirstName: 'John',
            primaryLastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '555-0123'
        }
    });

    await prisma.reservation.create({
        data: {
            campgroundId: campground.id,
            siteId: site.id,
            guestId: guest.id,
            arrivalDate: new Date(),
            departureDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
            adults: 2,
            status: 'checked_in',
            totalAmount: 15000
        }
    });
    console.log('Reservation created for John Doe at Site A101.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
