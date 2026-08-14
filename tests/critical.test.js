import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { runInTransaction } from "../utils/transaction.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret";

test("Project 5 critical API workflows", async (t) => {
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri)
    throw new Error("TEST_MONGODB_URI is required. Tests were not executed.");

  const { createApp } = await import("../server.js");
  const User = (await import("../models/User.js")).default;
  const Category = (await import("../models/Category.js")).default;
  const Product = (await import("../models/Product.js")).default;
  const Customer = (await import("../models/Customer.js")).default;
  const SalesOrder = (await import("../models/SalesOrder.js")).default;
  const StockMovement = (await import("../models/StockMovement.js")).default;
  const StockReceipt = (await import("../models/StockReceipt.js")).default;
  const Counter = (await import("../models/Counter.js")).default;

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    Category.init(),
    Product.init(),
    Customer.init(),
    SalesOrder.init(),
    StockMovement.init(),
    StockReceipt.init(),
    Counter.init(),
  ]);
  const [admin, sales, secondSales, warehouse] = await User.create([
    {
      name: "Test Admin",
      email: "test-admin@example.com",
      password: "admin123",
      role: "admin",
    },
    {
      name: "Test Sales",
      email: "test-sales@example.com",
      password: "sales123",
      role: "sales",
    },
    {
      name: "Second Sales",
      email: "second-sales@example.com",
      password: "sales123",
      role: "sales",
    },
    {
      name: "Test Warehouse",
      email: "test-warehouse@example.com",
      password: "warehouse123",
      role: "warehouse",
    },
  ]);
  const category = await Category.create({ name: "Test Category" });
  const [product, secondProduct] = await Product.create([
    {
      sku: "TEST-001",
      name: "Test Product",
      category: category._id,
      sellingPrice: 8500,
      stockQuantity: 10,
      reorderLevel: 2,
    },
    {
      sku: "TEST-002",
      name: "Second Product",
      category: category._id,
      sellingPrice: 1200,
      stockQuantity: 5,
      reorderLevel: 1,
    },
  ]);
  const customer = await Customer.create({
    name: "Test Customer",
    email: "customer@example.com",
    phone: "03001234567",
  });
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await response.json();
    return { response, data };
  }

  async function login(email, password) {
    const result = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    assert.equal(result.response.status, 200);
    return result.data.token;
  }

  try {
    const adminToken = await login(admin.email, "admin123");
    const salesToken = await login(sales.email, "sales123");
    const secondSalesToken = await login(secondSales.email, "sales123");
    const warehouseToken = await login(warehouse.email, "warehouse123");

    await t.test("authentication, hashing, and role checks", async () => {
      const unauthenticated = await request("/products");
      assert.equal(unauthenticated.response.status, 401);
      const warehouseUsers = await request("/users", {
        headers: { Authorization: `Bearer ${warehouseToken}` },
      });
      assert.equal(warehouseUsers.response.status, 403);
      const storedSales = await User.findById(sales._id).select("+password");
      assert.notEqual(storedSales.password, "sales123");
      assert.equal(
        await bcrypt.compare("sales123", storedSales.password),
        true,
      );
    });

    await t.test(
      "admin user pagination, search, role filters, and safe responses",
      async () => {
        const paged = await request("/users?page=1&limit=2", {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(paged.response.status, 200);
        assert.equal(paged.data.data.length, 2);
        assert.equal(paged.data.pagination.total, 4);
        assert.equal(paged.data.pagination.limit, 2);
        assert.equal(
          paged.data.data.some((entry) => Object.hasOwn(entry, "password")),
          false,
        );
        const filtered = await request(
          "/users?role=warehouse&isActive=true&search=warehouse",
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );
        assert.equal(filtered.response.status, 200);
        assert.equal(filtered.data.pagination.total, 1);
        assert.equal(filtered.data.data[0].role, "warehouse");
        const invalidFilter = await request("/users?isActive=maybe", {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(invalidFilter.response.status, 400);
      },
    );

    await t.test(
      "customer email normalization and duplicate handling",
      async () => {
        const duplicate = await request("/customers", {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            name: "Duplicate Customer",
            email: " CUSTOMER@EXAMPLE.COM ",
            phone: "03001234568",
          }),
        });
        assert.equal(duplicate.response.status, 409);
        const emptyOne = await request("/customers", {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            name: "No Email One",
            email: "   ",
            phone: "03001234569",
          }),
        });
        const emptyTwo = await request("/customers", {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            name: "No Email Two",
            email: "",
            phone: "03001234570",
          }),
        });
        assert.equal(emptyOne.response.status, 201);
        assert.equal(emptyTwo.response.status, 201);
        assert.equal(emptyOne.data.email, "");
      },
    );

    await t.test("failed transaction rolls back stock changes", async () => {
      const before = (await Product.findById(product._id)).stockQuantity;
      await assert.rejects(
        runInTransaction(async (session) => {
          const item = await Product.findById(product._id).session(session);
          item.stockQuantity -= 1;
          await item.save({ session });
          throw new Error("forced transaction failure");
        }),
        /forced transaction failure/,
      );
      assert.equal((await Product.findById(product._id)).stockQuantity, before);
    });

    await t.test("duplicate SKU is rejected with conflict", async () => {
      const duplicate = await request("/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          sku: product.sku,
          name: "Duplicate",
          category: category._id,
          sellingPrice: 1,
          reorderLevel: 0,
        }),
      });
      assert.equal(duplicate.response.status, 409);
    });

    const createOrderBody = (quantity = 1) => ({
      customer: customer._id,
      discount: "10.005",
      items: [{ product: product._id, quantity, unitPrice: 1, subtotal: 1 }],
    });
    await t.test(
      "Draft cancellation is direct, owned, and stock-neutral",
      async () => {
        const draftOrder = await request("/orders", {
          method: "POST",
          headers: { Authorization: `Bearer ${salesToken}` },
          body: JSON.stringify(createOrderBody()),
        });
        const beforeStock = (await Product.findById(product._id)).stockQuantity;
        const wrongOwner = await request(
          `/orders/${draftOrder.data._id}/cancel`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${secondSalesToken}` },
          },
        );
        assert.equal(wrongOwner.response.status, 403);
        const cancelled = await request(
          `/orders/${draftOrder.data._id}/cancel`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${salesToken}` },
          },
        );
        assert.equal(cancelled.response.status, 200);
        assert.equal(cancelled.data.status, "Cancelled");
        assert.equal(cancelled.data.stockAdjusted, false);
        assert.equal(
          (await Product.findById(product._id)).stockQuantity,
          beforeStock,
        );
        assert.equal(
          (
            await request(`/orders/${draftOrder.data._id}/cancel`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${salesToken}` },
            })
          ).response.status,
          400,
        );

        const adminDraft = await request("/orders", {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify(createOrderBody()),
        });
        const adminCancelled = await request(
          `/orders/${adminDraft.data._id}/cancel`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
          },
        );
        assert.equal(adminCancelled.response.status, 200);
        assert.equal(adminCancelled.data.status, "Cancelled");
      },
    );
    const primary = await request("/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify(createOrderBody(2)),
    });
    assert.equal(primary.response.status, 201);
    assert.equal(primary.data.items[0].unitPrice, 8500);
    assert.equal(primary.data.subtotal, 17000);
    assert.equal(primary.data.discount, 10.01);
    assert.equal(primary.data.total, 16989.99);
    assert.match(primary.data.orderNo, /^ORD-\d+$/);

    const mergedRows = await request("/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        customer: customer._id,
        items: [
          { product: product._id, quantity: 1 },
          { product: product._id, quantity: 2 },
        ],
      }),
    });
    assert.equal(mergedRows.response.status, 201);
    assert.equal(mergedRows.data.items.length, 1);
    assert.equal(mergedRows.data.items[0].quantity, 3);

    await t.test(
      "order numbers remain unique under concurrent creation",
      async () => {
        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            request("/orders", {
              method: "POST",
              headers: { Authorization: `Bearer ${salesToken}` },
              body: JSON.stringify(createOrderBody()),
            }),
          ),
        );
        assert.equal(
          results.every((result) => result.response.status === 201),
          true,
        );
        assert.equal(
          new Set(results.map((result) => result.data.orderNo)).size,
          5,
        );
      },
    );

    const otherSalesOrder = await request("/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${secondSalesToken}` },
      body: JSON.stringify(createOrderBody()),
    });
    assert.equal(otherSalesOrder.response.status, 201);
    const idor = await request(`/orders/${otherSalesOrder.data._id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    assert.equal(idor.response.status, 403);

    const receipt = await request("/stock-receipts", {
      method: "POST",
      headers: { Authorization: `Bearer ${warehouseToken}` },
      body: JSON.stringify({
        referenceNo: "TEST-RECEIPT-001",
        supplierName: "Test Supplier",
        receivedAt: new Date().toISOString().slice(0, 10),
        items: [{ product: secondProduct._id, quantity: 2, costPrice: 300 }],
      }),
    });
    assert.equal(receipt.response.status, 201);
    assert.equal(
      await StockMovement.countDocuments({
        referenceId: receipt.data._id,
        type: "IN",
      }),
      1,
    );

    const confirmed = await request(`/orders/${primary.data._id}/confirm`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.data.stockAdjusted, true);
    assert.equal((await Product.findById(product._id)).stockQuantity, 8);
    assert.equal(
      await StockMovement.countDocuments({
        referenceId: primary.data._id,
        type: "OUT",
      }),
      1,
    );
    const confirmedAgain = await request(
      `/orders/${primary.data._id}/confirm`,
      { method: "PATCH", headers: { Authorization: `Bearer ${salesToken}` } },
    );
    assert.equal(confirmedAgain.response.status, 400);
    assert.equal((await Product.findById(product._id)).stockQuantity, 8);

    const cancellationOrder = await request("/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify(createOrderBody()),
    });
    const cancellationConfirm = await request(
      `/orders/${cancellationOrder.data._id}/confirm`,
      { method: "PATCH", headers: { Authorization: `Bearer ${salesToken}` } },
    );
    assert.equal(cancellationConfirm.response.status, 200);
    assert.equal((await Product.findById(product._id)).stockQuantity, 7);
    const cancellationRequest = await request(
      `/orders/${cancellationOrder.data._id}/request-cancellation`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${salesToken}` },
        body: JSON.stringify({ reason: "Customer changed the order" }),
      },
    );
    assert.equal(cancellationRequest.response.status, 200);
    assert.equal(cancellationRequest.data.status, "Confirmed");
    assert.equal(cancellationRequest.data.cancellation.status, "Pending");
    const pending = await request("/orders?cancellationStatus=Pending", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(pending.data.pagination.total, 1);
    const approved = await request(
      `/orders/${cancellationOrder.data._id}/cancellation/approve`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ reviewNote: "Approved for test" }),
      },
    );
    assert.equal(approved.response.status, 200);
    assert.equal(approved.data.status, "Cancelled");
    assert.equal(approved.data.cancellation.status, "Approved");
    assert.equal(approved.data.stockRestored, true);
    assert.equal((await Product.findById(product._id)).stockQuantity, 8);
    assert.deepEqual(
      (
        await StockMovement.find({
          referenceId: cancellationOrder.data._id,
        }).sort({ createdAt: 1 })
      ).map((movement) => movement.type),
      ["OUT", "IN"],
    );
    const approvedAgain = await request(
      `/orders/${cancellationOrder.data._id}/cancellation/approve`,
      { method: "PATCH", headers: { Authorization: `Bearer ${adminToken}` } },
    );
    assert.equal(approvedAgain.response.status, 400);

    await t.test(
      "rejected cancellation preserves state and resubmits cleanly",
      async () => {
        const rejectedOrder = await request("/orders", {
          method: "POST",
          headers: { Authorization: `Bearer ${salesToken}` },
          body: JSON.stringify(createOrderBody()),
        });
        assert.equal(
          (
            await request(`/orders/${rejectedOrder.data._id}/confirm`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${salesToken}` },
            })
          ).response.status,
          200,
        );
        const beforeRejectStock = (await Product.findById(product._id))
          .stockQuantity;
        assert.equal(
          (
            await request(
              `/orders/${rejectedOrder.data._id}/request-cancellation`,
              {
                method: "PATCH",
                headers: { Authorization: `Bearer ${salesToken}` },
                body: JSON.stringify({ reason: "First reason" }),
              },
            )
          ).response.status,
          200,
        );
        const rejected = await request(
          `/orders/${rejectedOrder.data._id}/cancellation/reject`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ reviewNote: "Not approved" }),
          },
        );
        assert.equal(rejected.response.status, 200);
        assert.equal(rejected.data.status, "Confirmed");
        assert.equal(rejected.data.cancellation.status, "Rejected");
        assert.equal(
          (await Product.findById(product._id)).stockQuantity,
          beforeRejectStock,
        );
        const resubmitted = await request(
          `/orders/${rejectedOrder.data._id}/request-cancellation`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${salesToken}` },
            body: JSON.stringify({ reason: "Second reason" }),
          },
        );
        assert.equal(resubmitted.response.status, 200);
        assert.equal(resubmitted.data.cancellation.reason, "Second reason");
        assert.equal(resubmitted.data.cancellation.status, "Pending");
        assert.equal(resubmitted.data.cancellation.reviewedBy, null);
        assert.equal(resubmitted.data.cancellation.reviewedAt, null);
        assert.equal(resubmitted.data.cancellation.reviewNote, "");
        assert.equal(
          (
            await request(
              `/orders/${rejectedOrder.data._id}/cancellation/approve`,
              {
                method: "PATCH",
                headers: { Authorization: `Bearer ${adminToken}` },
              },
            )
          ).response.status,
          200,
        );
      },
    );

    await t.test(
      "simultaneous cancellation requests produce one pending request",
      async () => {
        const concurrentOrder = await request("/orders", {
          method: "POST",
          headers: { Authorization: `Bearer ${salesToken}` },
          body: JSON.stringify(createOrderBody()),
        });
        assert.equal(
          (
            await request(`/orders/${concurrentOrder.data._id}/confirm`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${salesToken}` },
            })
          ).response.status,
          200,
        );
        const results = await Promise.all([
          request(`/orders/${concurrentOrder.data._id}/request-cancellation`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${salesToken}` },
            body: JSON.stringify({ reason: "Concurrent one" }),
          }),
          request(`/orders/${concurrentOrder.data._id}/request-cancellation`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${salesToken}` },
            body: JSON.stringify({ reason: "Concurrent two" }),
          }),
        ]);
        assert.deepEqual(
          results.map((result) => result.response.status).sort((a, b) => a - b),
          [200, 409],
        );
        const stored = await SalesOrder.findById(concurrentOrder.data._id);
        assert.equal(stored.cancellation.status, "Pending");
        assert.equal(
          (
            await request(
              `/orders/${concurrentOrder.data._id}/cancellation/approve`,
              {
                method: "PATCH",
                headers: { Authorization: `Bearer ${adminToken}` },
              },
            )
          ).response.status,
          200,
        );
      },
    );

    await t.test(
      "simultaneous status updates have one winner and terminals stay terminal",
      async () => {
        const concurrentStatusOrder = await request("/orders", {
          method: "POST",
          headers: { Authorization: `Bearer ${salesToken}` },
          body: JSON.stringify(createOrderBody()),
        });
        assert.equal(
          (
            await request(`/orders/${concurrentStatusOrder.data._id}/confirm`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${salesToken}` },
            })
          ).response.status,
          200,
        );
        const processingResults = await Promise.all([
          request(`/orders/${concurrentStatusOrder.data._id}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${warehouseToken}` },
            body: JSON.stringify({ status: "Processing" }),
          }),
          request(`/orders/${concurrentStatusOrder.data._id}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${warehouseToken}` },
            body: JSON.stringify({ status: "Processing" }),
          }),
        ]);
        assert.deepEqual(
          processingResults
            .map((result) => result.response.status)
            .sort((a, b) => a - b),
          [200, 409],
        );
        const completedResults = await Promise.all([
          request(`/orders/${concurrentStatusOrder.data._id}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${warehouseToken}` },
            body: JSON.stringify({ status: "Completed" }),
          }),
          request(`/orders/${concurrentStatusOrder.data._id}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${warehouseToken}` },
            body: JSON.stringify({ status: "Completed" }),
          }),
        ]);
        assert.deepEqual(
          completedResults
            .map((result) => result.response.status)
            .sort((a, b) => a - b),
          [200, 409],
        );
        assert.equal(
          (
            await request(`/orders/${concurrentStatusOrder.data._id}/cancel`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${adminToken}` },
            })
          ).response.status,
          400,
        );
        assert.equal(
          (
            await request(
              `/orders/${concurrentStatusOrder.data._id}/request-cancellation`,
              {
                method: "PATCH",
                headers: { Authorization: `Bearer ${salesToken}` },
                body: JSON.stringify({ reason: "Terminal" }),
              },
            )
          ).response.status,
          400,
        );
      },
    );

    const insufficientOrder = await request("/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify(createOrderBody(7)),
    });
    assert.equal(insufficientOrder.response.status, 201);
    const terminalOrder = await request("/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify(createOrderBody()),
    });
    assert.equal(
      (
        await request(`/orders/${terminalOrder.data._id}/confirm`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${salesToken}` },
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await request(`/orders/${insufficientOrder.data._id}/confirm`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${salesToken}` },
        })
      ).response.status,
      400,
    );
    assert.equal(
      (
        await request(`/orders/${terminalOrder.data._id}/status`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${warehouseToken}` },
          body: JSON.stringify({ status: "Processing" }),
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await request(`/orders/${terminalOrder.data._id}/status`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${warehouseToken}` },
          body: JSON.stringify({ status: "Completed" }),
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await request(
          `/orders/${terminalOrder.data._id}/request-cancellation`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${salesToken}` },
            body: JSON.stringify({ reason: "Too late" }),
          },
        )
      ).response.status,
      400,
    );
    assert.equal(
      (
        await request(`/orders/${terminalOrder.data._id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${salesToken}` },
          body: JSON.stringify(createOrderBody()),
        })
      ).response.status,
      400,
    );
    assert.equal(
      (
        await request(`/orders/${terminalOrder.data._id}/status`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${warehouseToken}` },
          body: JSON.stringify({ status: "Draft" }),
        })
      ).response.status,
      400,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
