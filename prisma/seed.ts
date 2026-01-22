import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding roles...');

  const roles: RoleName[] = [
    RoleName.USER,
    RoleName.INSPECTOR,
    RoleName.ADMIN,
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { role_name: role },
      update: {},
      create: { role_name: role },
    });
  }

  console.log('✅ Roles seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
