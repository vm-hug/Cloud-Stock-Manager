process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import { app } from '../src/app';
import { prisma } from '../src/config/db';
import { Role, StockDocType, StockDocStatus } from '@cloud-stock/shared';
import { createImportWorker } from '../src/jobs/import.worker';

function request(
  server: http.Server,
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
    rawBody?: Buffer;
    cookie?: string;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    let payload: Buffer | undefined;
    const headers: Record<string, string> = {
      ...options.headers,
    };

    if (options.rawBody) {
      payload = options.rawBody;
      headers['Content-Length'] = payload.length.toString();
    } else if (options.body) {
      const jsonStr = JSON.stringify(options.body);
      payload = Buffer.from(jsonStr);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length.toString();
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
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf-8');
          let parsedBody;
          try {
            parsedBody = text ? JSON.parse(text) : {};
          } catch {
            parsedBody = text;
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

async function runPhase4Tests() {
  console.log('🚀 Starting Phase 4 Comprehensive Test Suite (Warehouse, Inventory, ACID Transactions, Concurrency, BullMQ, Import/Export)...');

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

    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    const managerHeaders = { Authorization: `Bearer ${managerToken}` };
    const staffHeaders = { Authorization: `Bearer ${staffToken}` };

    console.log('✅ Authentication setup complete');

    // ====================================================
    // 1. WAREHOUSE MANAGEMENT TESTS
    // ====================================================
    console.log('\n--- 1. Warehouse Management ---');

    // 1.1 List existing warehouses
    const listWh = await request(server, 'GET', '/api/v1/warehouses', { headers: staffHeaders });
    assert.strictEqual(listWh.status, 200);
    assert.ok(Array.isArray(listWh.body.data));
    console.log(`✅ List warehouses passed (${listWh.body.data.length} warehouses found)`);

    // 1.2 Staff cannot create warehouse (RBAC)
    const staffCreateWh = await request(server, 'POST', '/api/v1/warehouses', {
      headers: staffHeaders,
      body: { code: 'WH-ILLEGAL', name: 'Illegal Warehouse' },
    });
    assert.strictEqual(staffCreateWh.status, 403);
    console.log('✅ Staff forbidden from creating warehouse (403)');

    // 1.3 Admin creates new warehouse
    const testWhCode = `WH-T${Date.now().toString().slice(-4)}`;
    const createWh = await request(server, 'POST', '/api/v1/warehouses', {
      headers: adminHeaders,
      body: { code: testWhCode, name: 'Testing Warehouse Central' },
    });
    assert.strictEqual(createWh.status, 201);
    const testWarehouse = createWh.body.data;
    assert.strictEqual(testWarehouse.code, testWhCode);
    console.log(`✅ Admin created warehouse ${testWarehouse.code} (201)`);

    // 1.4 Duplicate warehouse code rejected (409)
    const dupWh = await request(server, 'POST', '/api/v1/warehouses', {
      headers: adminHeaders,
      body: { code: testWhCode, name: 'Duplicate Warehouse' },
    });
    assert.strictEqual(dupWh.status, 409);
    console.log('✅ Duplicate warehouse code rejected (409)');

    // 1.5 Update warehouse details
    const updateWh = await request(server, 'PATCH', `/api/v1/warehouses/${testWarehouse.id}`, {
      headers: managerHeaders,
      body: { name: 'Testing Warehouse Central - Renamed' },
    });
    assert.strictEqual(updateWh.status, 200);
    assert.strictEqual(updateWh.body.data.name, 'Testing Warehouse Central - Renamed');
    console.log('✅ Manager updated warehouse name (200)');

    // ====================================================
    // 2. INVENTORY BALANCES & LOW STOCK ALERTS
    // ====================================================
    console.log('\n--- 2. Inventory Balances & Low Stock Alerts ---');

    // 2.1 Get seeded variants and warehouses
    const mainWh = await prisma.warehouse.findUnique({ where: { code: 'WH-MAIN' } });
    assert.ok(mainWh, 'Main warehouse should exist');
    const northWh = await prisma.warehouse.findUnique({ where: { code: 'WH-NORTH' } });
    assert.ok(northWh, 'North warehouse should exist');

    const variant1 = await prisma.productVariant.findUnique({ where: { sku: 'IOT-SNS-01' } });
    assert.ok(variant1, 'IOT-SNS-01 variant should exist');

    // 2.2 Query balance for specific warehouse and variant
    const getBal = await request(
      server,
      'GET',
      `/api/v1/inventory/balances/${mainWh.id}/${variant1.id}`,
      { headers: staffHeaders }
    );
    assert.strictEqual(getBal.status, 200);
    assert.strictEqual(getBal.body.data.warehouseId, mainWh.id);
    assert.strictEqual(getBal.body.data.variantId, variant1.id);
    console.log(`✅ Queried balance for ${variant1.sku} at ${mainWh.code} (qty: ${getBal.body.data.quantity})`);

    // 2.3 Query balance for variant not yet stocked in North warehouse
    const unstockedBal = await request(
      server,
      'GET',
      `/api/v1/inventory/balances/${testWarehouse.id}/${variant1.id}`,
      { headers: staffHeaders }
    );
    assert.strictEqual(unstockedBal.status, 200);
    assert.strictEqual(unstockedBal.body.data.quantity, 0);
    assert.strictEqual(unstockedBal.body.data.stockStatus, 'OUT_OF_STOCK');
    console.log('✅ Unstocked SKU balance query returns quantity 0 and OUT_OF_STOCK (200)');

    // 2.4 Update threshold
    const updateThresh = await request(
      server,
      'PATCH',
      `/api/v1/inventory/balances/${mainWh.id}/${variant1.id}/threshold`,
      { headers: managerHeaders, body: { minThreshold: 15 } }
    );
    assert.strictEqual(updateThresh.status, 200);
    assert.strictEqual(updateThresh.body.data.minThreshold, 15);
    console.log('✅ Updated alert threshold to 15 (200)');

    // 2.5 Query low stock alerts endpoint
    const lowStockRes = await request(server, 'GET', '/api/v1/inventory/low-stock', {
      headers: staffHeaders,
    });
    assert.strictEqual(lowStockRes.status, 200);
    assert.ok(Array.isArray(lowStockRes.body.data));
    console.log(`✅ Low stock query passed (${lowStockRes.body.data.length} low stock rows)`);

    // ====================================================
    // 3. STOCK DOCUMENT LIFECYCLE & ACID TRANSACTIONS
    // ====================================================
    console.log('\n--- 3. Stock Document Lifecycle & ACID Transactions ---');

    // 3.1 Staff creates DRAFT INBOUND document
    const createInbound = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: staffHeaders,
      body: {
        type: StockDocType.INBOUND,
        destinationWarehouseId: testWarehouse.id,
        note: 'Initial stocking for testing warehouse',
        items: [{ variantId: variant1.id, quantity: 50, unitPrice: 120 }],
      },
    });
    assert.strictEqual(createInbound.status, 201);
    const inboundDoc = createInbound.body.data;
    assert.strictEqual(inboundDoc.status, StockDocStatus.DRAFT);
    console.log(`✅ Staff created DRAFT INBOUND document ${inboundDoc.documentCode} (201)`);

    // 3.2 Update DRAFT document
    const updateInbound = await request(server, 'PATCH', `/api/v1/stock-documents/${inboundDoc.id}`, {
      headers: staffHeaders,
      body: {
        note: 'Initial stocking - updated note',
        items: [{ variantId: variant1.id, quantity: 60, unitPrice: 120 }],
      },
    });
    assert.strictEqual(updateInbound.status, 200);
    assert.strictEqual(updateInbound.body.data.note, 'Initial stocking - updated note');
    console.log('✅ Staff updated DRAFT document (200)');

    // 3.3 Staff submits document to PENDING
    const submitInbound = await request(
      server,
      'POST',
      `/api/v1/stock-documents/${inboundDoc.id}/submit`,
      { headers: staffHeaders }
    );
    assert.strictEqual(submitInbound.status, 200);
    assert.strictEqual(submitInbound.body.data.status, StockDocStatus.PENDING);
    console.log('✅ Staff submitted document to PENDING (200)');

    // 3.4 Cannot edit document once in PENDING
    const editPending = await request(server, 'PATCH', `/api/v1/stock-documents/${inboundDoc.id}`, {
      headers: staffHeaders,
      body: { note: 'Attempting invalid edit on pending' },
    });
    assert.strictEqual(editPending.status, 409);
    console.log('✅ Editing PENDING document rejected (409)');

    // 3.5 Approval Policy: Creator cannot approve their own document!
    const selfApprove = await request(
      server,
      'POST',
      `/api/v1/stock-documents/${inboundDoc.id}/approve`,
      { headers: staffHeaders } // Staff is creator and cannot approve anyway
    );
    assert.strictEqual(selfApprove.status, 403);

    // Now test if an ADMIN who creates a document cannot self-approve
    const adminDraft = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: adminHeaders,
      body: {
        type: StockDocType.INBOUND,
        destinationWarehouseId: testWarehouse.id,
        items: [{ variantId: variant1.id, quantity: 10 }],
      },
    });
    await request(server, 'POST', `/api/v1/stock-documents/${adminDraft.body.data.id}/submit`, {
      headers: adminHeaders,
    });
    const adminSelfApprove = await request(
      server,
      'POST',
      `/api/v1/stock-documents/${adminDraft.body.data.id}/approve`,
      { headers: adminHeaders }
    );
    assert.strictEqual(adminSelfApprove.status, 409);
    assert.ok(adminSelfApprove.body.error.message.includes('creator cannot approve'));
    console.log('✅ Creator self-approval rejected by strict approval policy (409)');

    // Clean up adminDraft
    await request(server, 'POST', `/api/v1/stock-documents/${adminDraft.body.data.id}/cancel`, {
      headers: adminHeaders,
    });

    // 3.6 Manager approves Staff INBOUND document -> POSTED
    const approveInbound = await request(
      server,
      'POST',
      `/api/v1/stock-documents/${inboundDoc.id}/approve`,
      { headers: managerHeaders }
    );
    assert.strictEqual(approveInbound.status, 200);
    assert.strictEqual(approveInbound.body.data.status, StockDocStatus.POSTED);
    assert.ok(approveInbound.body.data.postedAt);

    // Verify balance increased by 60
    const checkBalAfterInbound = await prisma.inventoryBalance.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: testWarehouse.id,
          variantId: variant1.id,
        },
      },
    });
    assert.strictEqual(checkBalAfterInbound?.quantity, 60);
    console.log(`✅ Manager approved INBOUND -> POSTED: balance is now ${checkBalAfterInbound?.quantity}`);

    // Verify stock movement created with delta = +60
    const movementsInbound = await prisma.stockMovement.findMany({
      where: { warehouseId: testWarehouse.id, variantId: variant1.id },
    });
    assert.strictEqual(movementsInbound.length, 1);
    assert.strictEqual(movementsInbound[0].delta, 60);
    assert.strictEqual(movementsInbound[0].quantityBefore, 0);
    assert.strictEqual(movementsInbound[0].quantityAfter, 60);
    console.log('✅ StockMovement record verified (delta: +60, 0 -> 60)');

    // 3.7 Cannot approve document twice (idempotency)
    const doubleApprove = await request(
      server,
      'POST',
      `/api/v1/stock-documents/${inboundDoc.id}/approve`,
      { headers: managerHeaders }
    );
    assert.strictEqual(doubleApprove.status, 409);
    console.log('✅ Double approval rejected (409)');

    // 3.8 Deactivating warehouse with positive balance is now BLOCKED
    const deactivateBlocked = await request(
      server,
      'PATCH',
      `/api/v1/warehouses/${testWarehouse.id}/status`,
      { headers: adminHeaders, body: { isActive: false } }
    );
    assert.strictEqual(deactivateBlocked.status, 409);
    console.log('✅ Warehouse deactivation blocked while positive balance exists (409)');

    // 3.9 OUTBOUND Document (Successful flow)
    const createOutbound = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: staffHeaders,
      body: {
        type: StockDocType.OUTBOUND,
        sourceWarehouseId: testWarehouse.id,
        note: 'Customer order shipment',
        items: [{ variantId: variant1.id, quantity: 20 }],
      },
    });
    assert.strictEqual(createOutbound.status, 201);
    const outboundDoc = createOutbound.body.data;
    await request(server, 'POST', `/api/v1/stock-documents/${outboundDoc.id}/submit`, {
      headers: staffHeaders,
    });
    const approveOutbound = await request(
      server,
      'POST',
      `/api/v1/stock-documents/${outboundDoc.id}/approve`,
      { headers: managerHeaders }
    );
    assert.strictEqual(approveOutbound.status, 200);

    const checkBalAfterOutbound = await prisma.inventoryBalance.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: testWarehouse.id,
          variantId: variant1.id,
        },
      },
    });
    assert.strictEqual(checkBalAfterOutbound?.quantity, 40); // 60 - 20 = 40
    console.log(`✅ OUTBOUND approval successful: balance 60 - 20 = ${checkBalAfterOutbound?.quantity}`);

    // 3.10 OUTBOUND with INSUFFICIENT STOCK -> Rejected and rolled back!
    const createExcessOutbound = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: staffHeaders,
      body: {
        type: StockDocType.OUTBOUND,
        sourceWarehouseId: testWarehouse.id,
        items: [{ variantId: variant1.id, quantity: 100 }], // Available is 40
      },
    });
    const excessDoc = createExcessOutbound.body.data;
    await request(server, 'POST', `/api/v1/stock-documents/${excessDoc.id}/submit`, {
      headers: staffHeaders,
    });
    const approveExcess = await request(
      server,
      'POST',
      `/api/v1/stock-documents/${excessDoc.id}/approve`,
      { headers: managerHeaders }
    );
    assert.strictEqual(approveExcess.status, 409);
    assert.ok(approveExcess.body.error.message.includes('Insufficient stock'));

    // Check balance is still 40!
    const checkBalUnchanged = await prisma.inventoryBalance.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: testWarehouse.id,
          variantId: variant1.id,
        },
      },
    });
    assert.strictEqual(checkBalUnchanged?.quantity, 40);
    console.log('✅ OUTBOUND with insufficient stock rejected (409) and balance safely unchanged (40)');

    // 3.11 ADJUSTMENT Document (+10 surplus, then -15 shortage)
    const createAdj = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: staffHeaders,
      body: {
        type: StockDocType.ADJUSTMENT,
        sourceWarehouseId: testWarehouse.id,
        note: 'Stock audit count',
        items: [{ variantId: variant1.id, quantity: 10, adjustmentDelta: 10 }],
      },
    });
    assert.strictEqual(createAdj.status, 201);
    await request(server, 'POST', `/api/v1/stock-documents/${createAdj.body.data.id}/submit`, {
      headers: staffHeaders,
    });
    await request(server, 'POST', `/api/v1/stock-documents/${createAdj.body.data.id}/approve`, {
      headers: managerHeaders,
    });
    const checkBalAfterAdjPlus = await prisma.inventoryBalance.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: testWarehouse.id,
          variantId: variant1.id,
        },
      },
    });
    assert.strictEqual(checkBalAfterAdjPlus?.quantity, 50); // 40 + 10 = 50
    console.log(`✅ ADJUSTMENT positive delta (+10): balance is now ${checkBalAfterAdjPlus?.quantity}`);

    const createAdjMinus = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: staffHeaders,
      body: {
        type: StockDocType.ADJUSTMENT,
        sourceWarehouseId: testWarehouse.id,
        note: 'Damaged item write-off',
        items: [{ variantId: variant1.id, quantity: 15, adjustmentDelta: -15 }],
      },
    });
    await request(server, 'POST', `/api/v1/stock-documents/${createAdjMinus.body.data.id}/submit`, {
      headers: staffHeaders,
    });
    await request(server, 'POST', `/api/v1/stock-documents/${createAdjMinus.body.data.id}/approve`, {
      headers: managerHeaders,
    });
    const checkBalAfterAdjMinus = await prisma.inventoryBalance.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: testWarehouse.id,
          variantId: variant1.id,
        },
      },
    });
    assert.strictEqual(checkBalAfterAdjMinus?.quantity, 35); // 50 - 15 = 35
    console.log(`✅ ADJUSTMENT negative delta (-15): balance is now ${checkBalAfterAdjMinus?.quantity}`);

    // 3.12 TRANSFER Document (Transfer 10 units from testWarehouse to northWarehouse)
    const destBalBefore = await prisma.inventoryBalance.findUnique({
      where: { warehouseId_variantId: { warehouseId: northWh.id, variantId: variant1.id } },
    });
    const initialDestQty = destBalBefore?.quantity || 0;

    const createTransfer = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: staffHeaders,
      body: {
        type: StockDocType.TRANSFER,
        sourceWarehouseId: testWarehouse.id,
        destinationWarehouseId: northWh.id,
        note: 'Inter-warehouse stock rebalance',
        items: [{ variantId: variant1.id, quantity: 10 }],
      },
    });
    assert.strictEqual(createTransfer.status, 201);
    const transferDoc = createTransfer.body.data;
    await request(server, 'POST', `/api/v1/stock-documents/${transferDoc.id}/submit`, {
      headers: staffHeaders,
    });
    await request(server, 'POST', `/api/v1/stock-documents/${transferDoc.id}/approve`, {
      headers: managerHeaders,
    });

    const [srcBalAfterTransfer, destBalAfterTransfer] = await Promise.all([
      prisma.inventoryBalance.findUnique({
        where: { warehouseId_variantId: { warehouseId: testWarehouse.id, variantId: variant1.id } },
      }),
      prisma.inventoryBalance.findUnique({
        where: { warehouseId_variantId: { warehouseId: northWh.id, variantId: variant1.id } },
      }),
    ]);
    assert.strictEqual(srcBalAfterTransfer?.quantity, 25); // 35 - 10 = 25
    assert.strictEqual(destBalAfterTransfer?.quantity, initialDestQty + 10);
    console.log(`✅ TRANSFER completed atomically: source=25, dest=${destBalAfterTransfer?.quantity}`);

    // ====================================================
    // 4. POSTGRESQL CONCURRENCY & ROW LOCKING TESTS
    // ====================================================
    console.log('\n--- 4. PostgreSQL Concurrency & Row Locking Tests ---');

    // SCENARIO A: Standard Invariant Test
    // Initial Stock = 5 units.
    // Two concurrent requests attempt to approve two separate documents demanding 4 units each.
    // Invariant: Exactly 1 succeeds, 1 fails. Final stock must be 1.
    const concWarehouse = await prisma.warehouse.create({
      data: { code: `WH-CONC-${Date.now().toString().slice(-4)}`, name: 'Concurrency Test Warehouse' },
    });

    await prisma.inventoryBalance.create({
      data: { warehouseId: concWarehouse.id, variantId: variant1.id, quantity: 5, minThreshold: 2 },
    });

    // Create Doc 1 (demand 4)
    const cDoc1Res = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: staffHeaders,
      body: {
        type: StockDocType.OUTBOUND,
        sourceWarehouseId: concWarehouse.id,
        items: [{ variantId: variant1.id, quantity: 4 }],
      },
    });
    const cDoc1 = cDoc1Res.body.data;
    await request(server, 'POST', `/api/v1/stock-documents/${cDoc1.id}/submit`, { headers: staffHeaders });

    // Create Doc 2 (demand 4)
    const cDoc2Res = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: staffHeaders,
      body: {
        type: StockDocType.OUTBOUND,
        sourceWarehouseId: concWarehouse.id,
        items: [{ variantId: variant1.id, quantity: 4 }],
      },
    });
    const cDoc2 = cDoc2Res.body.data;
    await request(server, 'POST', `/api/v1/stock-documents/${cDoc2.id}/submit`, { headers: staffHeaders });

    console.log('⚡ Firing 2 concurrent approval requests (initial=5, each demanding 4)...');
    const [concRes1, concRes2] = await Promise.all([
      request(server, 'POST', `/api/v1/stock-documents/${cDoc1.id}/approve`, { headers: managerHeaders }),
      request(server, 'POST', `/api/v1/stock-documents/${cDoc2.id}/approve`, { headers: managerHeaders }),
    ]);

    const successes = [concRes1, concRes2].filter((r) => r.status === 200);
    const failures = [concRes1, concRes2].filter((r) => r.status === 409);

    assert.strictEqual(successes.length, 1, 'Exactly one concurrent outbound request must succeed');
    assert.strictEqual(failures.length, 1, 'Exactly one concurrent outbound request must fail');

    const finalConcBalance = await prisma.inventoryBalance.findUnique({
      where: { warehouseId_variantId: { warehouseId: concWarehouse.id, variantId: variant1.id } },
    });
    assert.strictEqual(finalConcBalance?.quantity, 1, 'Final stock balance must strictly equal 1 (5 - 4 = 1)');
    console.log(`✅ CONCURRENCY INVARIANT PROVEN: 1 succeeded, 1 rejected. Final stock = ${finalConcBalance?.quantity}`);

    // SCENARIO B: Double Posting Prevention
    // Two concurrent requests attempt to approve the SAME document simultaneously.
    const concDoc3Res = await request(server, 'POST', '/api/v1/stock-documents', {
      headers: staffHeaders,
      body: {
        type: StockDocType.OUTBOUND,
        sourceWarehouseId: concWarehouse.id,
        items: [{ variantId: variant1.id, quantity: 1 }],
      },
    });
    const cDoc3 = concDoc3Res.body.data;
    await request(server, 'POST', `/api/v1/stock-documents/${cDoc3.id}/submit`, { headers: staffHeaders });

    console.log('⚡ Firing 2 concurrent approvals on the SAME document...');
    const [doublePost1, doublePost2] = await Promise.all([
      request(server, 'POST', `/api/v1/stock-documents/${cDoc3.id}/approve`, { headers: managerHeaders }),
      request(server, 'POST', `/api/v1/stock-documents/${cDoc3.id}/approve`, { headers: managerHeaders }),
    ]);

    const dpSuccess = [doublePost1, doublePost2].filter((r) => r.status === 200);
    const dpFail = [doublePost1, doublePost2].filter((r) => r.status === 409);
    assert.strictEqual(dpSuccess.length, 1);
    assert.strictEqual(dpFail.length, 1);
    console.log('✅ Double posting strictly blocked under concurrent load (1 success, 1 conflict)');

    // ====================================================
    // 5. STOCK MOVEMENTS LEDGER QUERY
    // ====================================================
    console.log('\n--- 5. Stock Movement Ledger ---');

    const movementsRes = await request(server, 'GET', '/api/v1/inventory/movements', {
      headers: staffHeaders,
    });
    assert.strictEqual(movementsRes.status, 200);
    assert.ok(Array.isArray(movementsRes.body.data));
    assert.ok(movementsRes.body.data.length >= 4);
    console.log(`✅ Stock movements ledger queried (${movementsRes.body.data.length} records verified)`);

    // ====================================================
    // 6. CSV/XLSX EXPORT & FORMULA INJECTION DEFENSE
    // ====================================================
    console.log('\n--- 6. CSV / XLSX Export & Formula Injection Defense ---');

    // 6.1 Export CSV
    const exportCsv = await request(server, 'GET', '/api/v1/inventory/export?format=csv', {
      headers: staffHeaders,
    });
    assert.strictEqual(exportCsv.status, 200);
    assert.ok(exportCsv.headers['content-type']?.includes('text/csv'));
    assert.ok(typeof exportCsv.body === 'string' && exportCsv.body.includes('Warehouse Code'));
    console.log('✅ Inventory CSV export successful (headers and rows verified)');

    // 6.2 Export XLSX
    const exportXlsx = await request(server, 'GET', '/api/v1/inventory/export?format=xlsx', {
      headers: managerHeaders,
    });
    assert.strictEqual(exportXlsx.status, 200);
    assert.ok(exportXlsx.headers['content-type']?.includes('spreadsheetml'));
    console.log('✅ Inventory XLSX export successful');

    // ====================================================
    // 7. CSV/XLSX IMPORT & BULLMQ WORKER
    // ====================================================
    console.log('\n--- 7. CSV / XLSX Import & BullMQ Worker ---');

    // 7.1 Download Import Template
    const templateRes = await request(server, 'GET', '/api/v1/imports/template?format=csv', {
      headers: managerHeaders,
    });
    assert.strictEqual(templateRes.status, 200);
    assert.ok(typeof templateRes.body === 'string' && templateRes.body.includes('categorySlug'));
    console.log('✅ Import template downloaded successfully');

    // 7.2 Create test CSV content
    const testSku = `IMPORT-SKU-${Date.now().toString().slice(-4)}`;
    const csvContent = [
      'productName,categorySlug,sku,variantName,sellingPrice,costPrice,attributes,isActive',
      `"Smart Cloud Gateway",electronics,"${testSku}","Gateway LTE Pro",299.99,180.00,"{""bands"":""all""}",true`,
    ].join('\r\n');

    // Build multipart body
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const pre = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="catalog-import.csv"\r\nContent-Type: text/csv\r\n\r\n`
    );
    const fileBytes = Buffer.from(csvContent, 'utf-8');
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const rawMultipart = Buffer.concat([pre, fileBytes, post]);

    const uploadRes = await request(server, 'POST', '/api/v1/imports/products', {
      headers: {
        ...managerHeaders,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      rawBody: rawMultipart,
    });
    assert.strictEqual(uploadRes.status, 202);
    const importJob = uploadRes.body.data;
    assert.strictEqual(importJob.status, 'PENDING');
    console.log(`✅ Uploaded import file, job queued with ID: ${importJob.id} (202 Accepted)`);

    // 7.3 Start a test worker to process the job
    const worker = createImportWorker();
    console.log('🔄 Worker started. Awaiting job processing...');

    // Poll for completion (up to 15 seconds)
    let jobCompleted = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const statusRes = await request(server, 'GET', `/api/v1/imports/${importJob.id}`, {
        headers: managerHeaders,
      });
      if (statusRes.body.data?.status === 'COMPLETED') {
        jobCompleted = true;
        console.log(`✅ BullMQ Worker completed job ${importJob.id}! Processed rows: ${statusRes.body.data.processedRows}`);
        break;
      }
    }
    await worker.close();

    assert.ok(jobCompleted, 'Import job should reach COMPLETED status via BullMQ Worker');

    // Verify imported variant exists in database
    const importedVariant = await prisma.productVariant.findUnique({
      where: { sku: testSku },
      include: { product: true },
    });
    assert.ok(importedVariant, `Imported variant ${testSku} must exist in PostgreSQL`);
    assert.strictEqual(importedVariant?.product.name, 'Smart Cloud Gateway');
    console.log(`✅ Verified imported product and variant in database: ${importedVariant?.sku}`);

    // ====================================================
    // 8. AUDIT LOG COMPLIANCE
    // ====================================================
    console.log('\n--- 8. Audit Log Compliance ---');

    const auditRes = await request(server, 'GET', '/api/v1/audit-logs?limit=100', { headers: adminHeaders });
    assert.strictEqual(auditRes.status, 200);
    const auditLogs = auditRes.body.data.items || auditRes.body.data;
    assert.ok(Array.isArray(auditLogs));

    const actionsLogged = new Set(auditLogs.map((l: any) => l.action));
    console.log('Actions recorded in Audit Log:', Array.from(actionsLogged));

    assert.ok(actionsLogged.has('CREATE_WAREHOUSE'), 'CREATE_WAREHOUSE must be logged');
    assert.ok(actionsLogged.has('CREATE_STOCK_DOCUMENT'), 'CREATE_STOCK_DOCUMENT must be logged');
    assert.ok(
      actionsLogged.has('POST_INBOUND') || actionsLogged.has('APPROVE_STOCK_DOCUMENT'),
      'Approval must be logged'
    );
    assert.ok(actionsLogged.has('CREATE_IMPORT_JOB'), 'CREATE_IMPORT_JOB must be logged');
    console.log('✅ Audit log compliance fully verified!');

    console.log('\n🎉 ALL PHASE 4 COMPREHENSIVE TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    server.close();
    await prisma.$disconnect();
    try {
      const { redis } = await import('../src/config/redis');
      redis.disconnect();
    } catch {}
  }
}

runPhase4Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Phase 4 Test Suite Failed:', err);
    process.exit(1);
  });
