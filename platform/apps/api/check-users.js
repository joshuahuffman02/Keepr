const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      take: 10
    });

    console.log(`Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.firstName} ${user.lastName})`);
    });

    if (users.length === 0) {
      console.log('\nNo users found! Need to create them.');
    }
  } catch (error) {
    console.error('Error checking users:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
