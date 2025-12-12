import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

async function main() {
    const reservation = await prisma.reservation.findFirst({
        where: {
            guest: {
                email: 'john.doe@example.com'
            }
        }
    });

    if (reservation) {
        console.log(`RESERVATION_ID: ${reservation.id}`);
        console.log(`CAMPGROUND_ID: ${reservation.campgroundId}`);
    } else {
        console.log('No reservation found for john.doe@example.com');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
