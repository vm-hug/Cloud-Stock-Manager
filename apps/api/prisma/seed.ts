import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if present
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function main() {
  console.log('🌱 Starting idempotent database seed...');

  // 1. Validate required environment variables for seed credentials
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const managerEmail = process.env.SEED_MANAGER_EMAIL;
  const managerPassword = process.env.SEED_MANAGER_PASSWORD;
  const staffEmail = process.env.SEED_STAFF_EMAIL;
  const staffPassword = process.env.SEED_STAFF_PASSWORD;

  if (!adminEmail || !adminPassword || !managerEmail || !managerPassword || !staffEmail || !staffPassword) {
    throw new Error(
      '❌ Missing required seed environment variables. Please ensure SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_MANAGER_EMAIL, SEED_MANAGER_PASSWORD, SEED_STAFF_EMAIL, and SEED_STAFF_PASSWORD are set.'
    );
  }

  // 2. Seed Users (Admin, Manager, Staff)
  const hashedAdminPassword = await hashPassword(adminPassword);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'System Administrator',
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: 'System Administrator',
      passwordHash: hashedAdminPassword,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const hashedManagerPassword = await hashPassword(managerPassword);
  const managerUser = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      name: 'Operations Manager',
      role: Role.MANAGER,
      isActive: true,
    },
    create: {
      email: managerEmail,
      name: 'Operations Manager',
      passwordHash: hashedManagerPassword,
      role: Role.MANAGER,
      isActive: true,
    },
  });

  const hashedStaffPassword = await hashPassword(staffPassword);
  const staffUser = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {
      name: 'Warehouse Staff',
      role: Role.STAFF,
      isActive: true,
    },
    create: {
      email: staffEmail,
      name: 'Warehouse Staff',
      passwordHash: hashedStaffPassword,
      role: Role.STAFF,
      isActive: true,
    },
  });

  console.log(`✅ Users seeded: Admin (${adminUser.email}), Manager (${managerUser.email}), Staff (${staffUser.email})`);

  // 3. Seed Default Warehouse
  const defaultWarehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-MAIN' },
    update: {
      name: 'Main Distribution Center',
      isActive: true,
    },
    create: {
      code: 'WH-MAIN',
      name: 'Main Distribution Center',
      isActive: true,
    },
  });
  console.log(`✅ Warehouse seeded: ${defaultWarehouse.name} [${defaultWarehouse.code}]`);

  // 4. Seed Category
  const category = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {
      name: 'Electronics & Sensors',
      description: 'Industrial IoT and tracking electronic hardware',
      isActive: true,
    },
    create: {
      name: 'Electronics & Sensors',
      slug: 'electronics',
      description: 'Industrial IoT and tracking electronic hardware',
      isActive: true,
    },
  });
  console.log(`✅ Category seeded: ${category.name} [${category.slug}]`);

  // 5. Seed Product
  const product = await prisma.product.upsert({
    where: { slug: 'cloud-iot-sensor' },
    update: {
      name: 'Cloud IoT Smart Sensor',
      categoryId: category.id,
      description: 'Real-time telemetry and atmospheric monitoring node',
      isActive: true,
    },
    create: {
      name: 'Cloud IoT Smart Sensor',
      slug: 'cloud-iot-sensor',
      categoryId: category.id,
      description: 'Real-time telemetry and atmospheric monitoring node',
      isActive: true,
    },
  });
  console.log(`✅ Product seeded: ${product.name} [${product.slug}]`);

  // 6. Seed Product Variants (NO quantity column in variant!)
  const variantStandard = await prisma.productVariant.upsert({
    where: { sku: 'IOT-SNS-01' },
    update: {
      name: 'Standard Edition (WiFi)',
      price: 120.0,
      costPrice: 80.0,
      isActive: true,
    },
    create: {
      productId: product.id,
      sku: 'IOT-SNS-01',
      name: 'Standard Edition (WiFi)',
      price: 120.0,
      costPrice: 80.0,
      isActive: true,
    },
  });

  const variantPro = await prisma.productVariant.upsert({
    where: { sku: 'IOT-SNS-02' },
    update: {
      name: 'Pro Edition (WiFi + Cellular LTE-M)',
      price: 220.0,
      costPrice: 140.0,
      isActive: true,
    },
    create: {
      productId: product.id,
      sku: 'IOT-SNS-02',
      name: 'Pro Edition (WiFi + Cellular LTE-M)',
      price: 220.0,
      costPrice: 140.0,
      isActive: true,
    },
  });
  console.log(`✅ Product Variants seeded: ${variantStandard.sku}, ${variantPro.sku}`);

  // 7. Seed Initial Inventory Balances in inventory_balances
  const balanceStandard = await prisma.inventoryBalance.upsert({
    where: {
      warehouseId_variantId: {
        warehouseId: defaultWarehouse.id,
        variantId: variantStandard.id,
      },
    },
    update: {
      minThreshold: 10,
    },
    create: {
      warehouseId: defaultWarehouse.id,
      variantId: variantStandard.id,
      quantity: 100,
      minThreshold: 10,
    },
  });

  const balancePro = await prisma.inventoryBalance.upsert({
    where: {
      warehouseId_variantId: {
        warehouseId: defaultWarehouse.id,
        variantId: variantPro.id,
      },
    },
    update: {
      minThreshold: 10,
    },
    create: {
      warehouseId: defaultWarehouse.id,
      variantId: variantPro.id,
      quantity: 100,
      minThreshold: 10,
    },
  });

  console.log(
    `✅ Initial Inventory Balances seeded: ${variantStandard.sku} (${balanceStandard.quantity} units), ${variantPro.sku} (${balancePro.quantity} units) at ${defaultWarehouse.code}`
  );

  console.log('✨ Seed completed successfully and idempotently!');
}

main()
  .catch((e) => {
    console.error('❌ Error executing seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
