
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
const prisma = new PrismaClient({ adapter });

async function main() {
    const reservation = await prisma.reservation.findFirst({
        include: { guest: true, site: true, campground: true }
    });
    console.log(reservation?.id);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
