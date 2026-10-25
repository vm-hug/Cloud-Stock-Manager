process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import { app } from '../src/app';
import { prisma } from '../src/config/db';
import { Role } from '@cloud-stock/shared';

function request(
  server: http.Server,
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
    cookie?: string;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      ...options.headers,
    };

    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        method,
        path,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsedBody;
          try {
            parsedBody = data ? JSON.parse(data) : {};
          } catch {
            parsedBody = data;
          }

          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: parsedBody,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runPhase3Tests() {
  console.log('🚀 Starting Phase 3 Comprehensive Test Suite (Catalog, Variants, Cloudinary, RBAC)...');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  console.log(`📡 Test server running on port ${port}`);

  try {
    // ----------------------------------------------------
    // SETUP: Authenticate ADMIN, MANAGER, and STAFF
    // ----------------------------------------------------
    const adminLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'admin@cloudstock.dev', password: 'AdminPassword123!' },
    });
    assert.strictEqual(adminLogin.status, 200);
    const adminToken = adminLogin.body.data.accessToken;

    const managerLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'manager@cloudstock.dev', password: 'ManagerPassword123!' },
    });
    assert.strictEqual(managerLogin.status, 200);
    const managerToken = managerLogin.body.data.accessToken;

    const staffLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'staff@cloudstock.dev', password: 'StaffPassword123!' },
    });
    assert.strictEqual(staffLogin.status, 200);
    const staffToken = staffLogin.body.data.accessToken;

    // ====================================================
    // 1. CATEGORY TESTS & RBAC
    // ====================================================
    console.log('\n--- 1. Category Management Tests ---');

    // 1.1 Staff CANNOT create category (403)
    const staffCreateCat = await request(server, 'POST', '/api/v1/categories', {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { name: 'Unauthorized Category' },
    });
    assert.strictEqual(staffCreateCat.status, 403);
    console.log('✅ STAFF denied POST /categories (403 Forbidden)');

    // 1.2 Admin creates category
    const catSlug = `electronics-test-${Date.now()}`;
    const createCatRes = await request(server, 'POST', '/api/v1/categories', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Electronics Test',
        slug: catSlug,
        description: 'Test category description',
        isActive: true,
      },
    });
    assert.strictEqual(createCatRes.status, 201);
    assert.strictEqual(createCatRes.body.data.slug, catSlug);
    const testCategoryId = createCatRes.body.data.id;
    console.log(`✅ Admin created category [${catSlug}] (201)`);

    // 1.3 Duplicate slug rejected with 409 Conflict
    const dupCatRes = await request(server, 'POST', '/api/v1/categories', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Another Name',
        slug: catSlug,
      },
    });
    assert.strictEqual(dupCatRes.status, 409);
    console.log('✅ Duplicate category slug rejected (409 Conflict)');

    // 1.4 Manager can update category
    const updateCatRes = await request(server, 'PATCH', `/api/v1/categories/${testCategoryId}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { description: 'Updated by Manager' },
    });
    assert.strictEqual(updateCatRes.status, 200);
    assert.strictEqual(updateCatRes.body.data.description, 'Updated by Manager');
    console.log('✅ MANAGER updated category (200)');

    // 1.5 Staff CAN view categories (200)
    const staffGetCats = await request(server, 'GET', '/api/v1/categories', {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(staffGetCats.status, 200);
    assert.ok(staffGetCats.body.data.length > 0);
    console.log('✅ STAFF allowed GET /categories (200)');

    // ====================================================
    // 2. PRODUCT TESTS & INVARIANTS
    // ====================================================
    console.log('\n--- 2. Product Management Tests ---');

    // 2.1 Staff CANNOT create product (403)
    const staffCreateProd = await request(server, 'POST', '/api/v1/products', {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        name: 'Illegal Product',
        categoryId: testCategoryId,
      },
    });
    assert.strictEqual(staffCreateProd.status, 403);
    console.log('✅ STAFF denied POST /products (403 Forbidden)');

    // 2.2 Cannot create product with non-existent category (404)
    const fakeCatProd = await request(server, 'POST', '/api/v1/products', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Fake Cat Product',
        categoryId: '00000000-0000-0000-0000-000000000000',
      },
    });
    assert.strictEqual(fakeCatProd.status, 404);
    console.log('✅ Create product with invalid categoryId rejected (404)');

    // 2.3 Manager creates valid Product
    const prodName = `Smart Test Device ${Date.now()}`;
    const createProdRes = await request(server, 'POST', '/api/v1/products', {
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        name: prodName,
        categoryId: testCategoryId,
        description: 'A premium cloud-managed smart test device',
      },
    });
    assert.strictEqual(createProdRes.status, 201);
    assert.ok(createProdRes.body.data.slug);
    const testProductId = createProdRes.body.data.id;
    console.log(`✅ MANAGER created product [${prodName}] (201)`);

    // 2.4 Invariant: Cannot deactivate category containing active products
    const deactCatAttempt = await request(server, 'PATCH', `/api/v1/categories/${testCategoryId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: false },
    });
    assert.strictEqual(deactCatAttempt.status, 409);
    console.log('✅ Invariant Protected: Cannot deactivate category containing active products (409 Conflict)');

    // 2.5 Update product details
    const updateProdRes = await request(server, 'PATCH', `/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { description: 'Updated product description' },
    });
    assert.strictEqual(updateProdRes.status, 200);
    assert.strictEqual(updateProdRes.body.data.description, 'Updated product description');
    console.log('✅ Admin updated product (200)');

    // 2.6 Staff can view product detail
    const staffGetProd = await request(server, 'GET', `/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(staffGetProd.status, 200);
    assert.strictEqual(staffGetProd.body.data.name, prodName);
    console.log('✅ STAFF allowed GET /products/:id (200)');

    // ====================================================
    // 3. PRODUCT VARIANT / SKU TESTS
    // ====================================================
    console.log('\n--- 3. Product Variant & SKU Tests ---');

    // 3.1 Staff CANNOT create variant (403)
    const staffCreateVar = await request(server, 'POST', `/api/v1/products/${testProductId}/variants`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        sku: `STAFF-SKU-${Date.now()}`,
        name: 'Staff Variant',
        price: 150000,
      },
    });
    assert.strictEqual(staffCreateVar.status, 403);
    console.log('✅ STAFF denied POST /products/:id/variants (403 Forbidden)');

    // 3.2 Admin creates Variant 1
    const sku1 = `DEV-BLK-${Date.now()}`;
    const createVar1 = await request(server, 'POST', `/api/v1/products/${testProductId}/variants`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        sku: sku1,
        name: 'Black Edition',
        price: 299000,
        costPrice: 180000,
        attributes: { color: 'Black', storage: '128GB' },
      },
    });
    assert.strictEqual(createVar1.status, 201);
    assert.strictEqual(createVar1.body.data.sku, sku1.toUpperCase());
    const var1Id = createVar1.body.data.id;
    console.log(`✅ Admin created variant 1 [${sku1}] (201)`);

    // 3.3 Create duplicate SKU rejected (409 Conflict)
    const dupSkuRes = await request(server, 'POST', `/api/v1/products/${testProductId}/variants`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        sku: sku1,
        name: 'Duplicate SKU variant',
        price: 250000,
      },
    });
    assert.strictEqual(dupSkuRes.status, 409);
    console.log('✅ Duplicate SKU rejected (409 Conflict)');

    // 3.4 Invariant check: Negative price rejected
    const negPriceRes = await request(server, 'POST', `/api/v1/products/${testProductId}/variants`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        sku: `NEG-PRICE-${Date.now()}`,
        name: 'Negative price item',
        price: -500,
      },
    });
    assert.strictEqual(negPriceRes.status, 400);
    console.log('✅ Negative price rejected by Zod schema (400)');

    // 3.5 Create Variant 2 (White edition)
    const sku2 = `DEV-WHT-${Date.now()}`;
    const createVar2 = await request(server, 'POST', `/api/v1/products/${testProductId}/variants`, {
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        sku: sku2,
        name: 'White Edition',
        price: 319000,
        costPrice: 190000,
        attributes: { color: 'White', storage: '256GB' },
      },
    });
    assert.strictEqual(createVar2.status, 201);
    const var2Id = createVar2.body.data.id;
    console.log(`✅ MANAGER created variant 2 [${sku2}] (201)`);

    // 3.6 Invariant: Inability to delete SKU with positive inventory balance
    // Seed an inventory balance for var2Id to test inventory protection
    const mainWarehouse = await prisma.warehouse.findFirst();
    assert.ok(mainWarehouse, 'Main warehouse WH-MAIN must exist');

    await prisma.inventoryBalance.upsert({
      where: {
        warehouseId_variantId: {
          warehouseId: mainWarehouse.id,
          variantId: var2Id,
        },
      },
      update: { quantity: 15 },
      create: {
        warehouseId: mainWarehouse.id,
        variantId: var2Id,
        quantity: 15,
      },
    });

    const delVar2Attempt = await request(server, 'DELETE', `/api/v1/variants/${var2Id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(delVar2Attempt.status, 409);
    console.log('✅ Invariant Protected: Attempt to delete variant with positive stock rejected (409 Conflict)');

    // 3.7 Delete Variant 1 (0 stock) succeeds via soft delete
    const delVar1 = await request(server, 'DELETE', `/api/v1/variants/${var1Id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(delVar1.status, 200);
    assert.strictEqual(delVar1.body.data.isActive, false);
    console.log('✅ Soft delete variant with 0 stock succeeded (200)');

    // Restore Variant 1
    const restoreVar1 = await request(server, 'PATCH', `/api/v1/variants/${var1Id}/restore`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(restoreVar1.status, 200);
    assert.strictEqual(restoreVar1.body.data.isActive, true);
    console.log('✅ Restore variant succeeded (200)');

    // ====================================================
    // 4. CLOUDINARY MEDIA MANAGEMENT TESTS
    // ====================================================
    console.log('\n--- 4. Cloudinary Media Management Tests ---');

    // 4.1 Staff CANNOT request signed upload params (403)
    const staffSignRes = await request(server, 'POST', `/api/v1/products/${testProductId}/images/sign`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(staffSignRes.status, 403);
    console.log('✅ STAFF denied signed upload signature (403 Forbidden)');

    // 4.2 Admin requests signed upload parameters
    const adminSignRes = await request(server, 'POST', `/api/v1/products/${testProductId}/images/sign`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminSignRes.status, 200);
    assert.ok(adminSignRes.body.data.signature);
    assert.ok(adminSignRes.body.data.timestamp);
    assert.ok(adminSignRes.body.data.publicId.includes(testProductId));
    const publicId1 = adminSignRes.body.data.publicId;
    console.log(`✅ Admin received signed upload parameters with folder namespace [${publicId1}] (200)`);

    // 4.3 Confirm Image 1 (Should become primary by default as first image)
    const confirmImg1 = await request(server, 'POST', `/api/v1/products/${testProductId}/images/confirm`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        publicId: publicId1,
        url: `https://res.cloudinary.com/mock_cloud/image/upload/${publicId1}.webp`,
        altText: 'Front View',
        isPrimary: false, // first image will be promoted to primary automatically
      },
    });
    assert.strictEqual(confirmImg1.status, 201);
    assert.strictEqual(confirmImg1.body.data.isPrimary, true);
    const img1Id = confirmImg1.body.data.id;
    console.log('✅ Image 1 confirmed and promoted to primary automatically (201)');

    // 4.4 Confirm Image 2 and set as primary
    const publicId2 = `cloud-stock/products/${testProductId}/img_${Date.now()}_2`;
    const confirmImg2 = await request(server, 'POST', `/api/v1/products/${testProductId}/images/confirm`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        publicId: publicId2,
        url: `https://res.cloudinary.com/mock_cloud/image/upload/${publicId2}.webp`,
        altText: 'Side View',
        isPrimary: true, // explicitly primary
      },
    });
    assert.strictEqual(confirmImg2.status, 201);
    assert.strictEqual(confirmImg2.body.data.isPrimary, true);
    const img2Id = confirmImg2.body.data.id;
    console.log('✅ Image 2 confirmed as primary (201)');

    // Verify Image 1 is no longer primary (Single Primary Image Invariant)
    const checkImg1 = await prisma.productImage.findUnique({ where: { id: img1Id } });
    assert.strictEqual(checkImg1?.isPrimary, false);
    console.log('✅ Invariant Verified: Image 1 demoted, exactly 1 primary image exists');

    // 4.5 Set Image 1 back to primary
    const setPrimaryRes = await request(server, 'PATCH', `/api/v1/products/${testProductId}/images/${img1Id}/primary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(setPrimaryRes.status, 200);
    assert.strictEqual(setPrimaryRes.body.data.isPrimary, true);
    const checkImg2After = await prisma.productImage.findUnique({ where: { id: img2Id } });
    assert.strictEqual(checkImg2After?.isPrimary, false);
    console.log('✅ Promoted Image 1 to primary; Image 2 demoted accordingly');

    // 4.6 Staff can view images
    const staffGetImgs = await request(server, 'GET', `/api/v1/products/${testProductId}/images`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(staffGetImgs.status, 200);
    assert.strictEqual(staffGetImgs.body.data.length, 2);
    console.log('✅ STAFF allowed GET /products/:id/images (200, count: 2)');

    // 4.7 Delete primary image (img1Id)
    // Deleting primary image should promote next image (img2Id) to primary
    const delImg1 = await request(server, 'DELETE', `/api/v1/products/${testProductId}/images/${img1Id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(delImg1.status, 200);
    const checkImg2Promoted = await prisma.productImage.findUnique({ where: { id: img2Id } });
    assert.strictEqual(checkImg2Promoted?.isPrimary, true);
    console.log('✅ Primary image deleted; next image automatically promoted to primary (200)');

    // ====================================================
    // 5. PRODUCT SOFT DELETE & RESTORE INVARIANTS
    // ====================================================
    console.log('\n--- 5. Product Soft Delete & Restore ---');

    // 5.1 Soft delete product
    const softDelProd = await request(server, 'DELETE', `/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(softDelProd.status, 200);
    assert.strictEqual(softDelProd.body.data.isActive, false);
    assert.ok(softDelProd.body.data.deletedAt);
    console.log('✅ Product soft deleted (isActive=false, deletedAt set)');

    // Verify variants and images still exist in DB
    const variantsCount = await prisma.productVariant.count({ where: { productId: testProductId } });
    assert.ok(variantsCount >= 2, 'Variants must NOT be deleted upon product soft delete');
    const imagesCount = await prisma.productImage.count({ where: { productId: testProductId } });
    assert.ok(imagesCount >= 1, 'Images must NOT be deleted upon product soft delete');
    console.log('✅ Invariant Verified: Product soft delete preserved variants, images, and inventory intact');

    // 5.2 Restore product
    const restoreProd = await request(server, 'PATCH', `/api/v1/products/${testProductId}/restore`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(restoreProd.status, 200);
    assert.strictEqual(restoreProd.body.data.isActive, true);
    assert.strictEqual(restoreProd.body.data.deletedAt, null);
    console.log('✅ Product restored successfully (200)');

    // ====================================================
    // 6. AUDIT LOGS VERIFICATION
    // ====================================================
    console.log('\n--- 6. Phase 3 Audit Log Compliance ---');
    const auditRes = await request(server, 'GET', '/api/v1/audit-logs?limit=50', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(auditRes.status, 200);
    const phase3Actions = auditRes.body.data.items.map((i: any) => i.action);

    assert.ok(phase3Actions.includes('CREATE_CATEGORY'), 'Must log CREATE_CATEGORY');
    assert.ok(phase3Actions.includes('CREATE_PRODUCT'), 'Must log CREATE_PRODUCT');
    assert.ok(phase3Actions.includes('CREATE_VARIANT'), 'Must log CREATE_VARIANT');
    assert.ok(phase3Actions.includes('UPLOAD_PRODUCT_IMAGE'), 'Must log UPLOAD_PRODUCT_IMAGE');
    assert.ok(phase3Actions.includes('DELETE_PRODUCT'), 'Must log DELETE_PRODUCT');
    assert.ok(phase3Actions.includes('RESTORE_PRODUCT'), 'Must log RESTORE_PRODUCT');
    console.log('✅ All Phase 3 actions successfully recorded in Audit Log');

    console.log('\n🎉 ALL PHASE 3 INTEGRATION TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
    await prisma.$disconnect();
    try {
      const { redis } = await import('../src/config/redis');
      redis.disconnect();
    } catch {}
  }
}

runPhase3Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ PHASE 3 TEST SUITE FAILED:', err);
    process.exit(1);
  });
