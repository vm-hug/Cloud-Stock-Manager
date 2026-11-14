import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function main() {
  console.log('🧹 Cleaning all test data and seeding the 3 core user accounts...');

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@gmail.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin1234@';

  const managerEmail = process.env.SEED_MANAGER_EMAIL || 'manager@gmail.com';
  const managerPassword = process.env.SEED_MANAGER_PASSWORD || 'manager1234@';

  const staffEmail = process.env.SEED_STAFF_EMAIL || 'minhhung@gmail.com';
  const staffPassword = process.env.SEED_STAFF_PASSWORD || 'minhhung1234@';

  // 1. Delete all test/domain records in reverse foreign-key dependency order
  await prisma.stockMovement.deleteMany({});
  await prisma.stockDocumentItem.deleteMany({});
  await prisma.stockDocument.deleteMany({});
  await prisma.inventoryBalance.deleteMany({});
  await prisma.importJob.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.refreshSession.deleteMany({});

  // Remove any users other than the 3 target accounts
  await prisma.user.deleteMany({
    where: {
      email: {
        notIn: [adminEmail, managerEmail, staffEmail],
      },
    },
  });

  // 2. Hash passwords securely with bcrypt
  const [adminHash, managerHash, staffHash] = await Promise.all([
    bcrypt.hash(adminPassword, BCRYPT_ROUNDS),
    bcrypt.hash(managerPassword, BCRYPT_ROUNDS),
    bcrypt.hash(staffPassword, BCRYPT_ROUNDS),
  ]);

  // 3. Upsert the 3 core accounts
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Administrator',
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      name: 'Administrator',
      email: adminEmail,
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      name: 'Warehouse Manager',
      passwordHash: managerHash,
      role: Role.MANAGER,
      isActive: true,
    },
    create: {
      name: 'Warehouse Manager',
      email: managerEmail,
      passwordHash: managerHash,
      role: Role.MANAGER,
      isActive: true,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {
      name: 'Minh Hưng (Staff)',
      passwordHash: staffHash,
      role: Role.STAFF,
      isActive: true,
    },
    create: {
      name: 'Minh Hưng (Staff)',
      email: staffEmail,
      passwordHash: staffHash,
      role: Role.STAFF,
      isActive: true,
    },
  });

  console.log(`✅ Users seeded:
    - ADMIN:   ${admin.email}
    - MANAGER: ${manager.email}
    - STAFF:   ${staff.email}`);
  console.log('🎉 Database is clean of test data and ready for real data entry.');
}

main()
  .catch((error) => {
    console.error('❌ Database seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
