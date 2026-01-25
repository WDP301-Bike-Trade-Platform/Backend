import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: 'Giant' },
    { name: 'Trek' },
    { name: 'Specialized' },
    { name: 'Cannondale' },
    { name: 'Scott' },
    { name: 'Merida' },
    { name: 'Trinx' },
    { name: 'Twitter' },
    { name: 'Fornix' },
    { name: 'Khác' }, // category mặc định
  ];

  for (const category of categories) {
    const exists = await prisma.category.findFirst({
      where: { name: category.name },
    });

    if (!exists) {
      await prisma.category.create({
        data: category,
      });
    }
  }

  console.log('✅ Seed bicycle categories success');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
