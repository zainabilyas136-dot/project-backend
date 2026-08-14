import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import Category from "./models/Category.js";
import Customer from "./models/Customer.js";
import Counter from "./models/Counter.js";
import Product from "./models/Product.js";
import SalesOrder from "./models/SalesOrder.js";
import StockMovement from "./models/StockMovement.js";
import StockReceipt from "./models/StockReceipt.js";
import User from "./models/User.js";

dotenv.config();
await connectDB();
await Promise.all([
  User.deleteMany(),
  Category.deleteMany(),
  Product.deleteMany(),
  Customer.deleteMany(),
  SalesOrder.deleteMany(),
  StockReceipt.deleteMany(),
  StockMovement.deleteMany(),
  Counter.deleteMany(),
]);

const [admin, sales, warehouse] = await User.create([
  {
    name: "Admin User",
    email: "admin@example.com",
    password: "admin123",
    role: "admin",
  },
  {
    name: "Sales Staff",
    email: "sales@example.com",
    password: "sales123",
    role: "sales",
  },
  {
    name: "Warehouse Staff",
    email: "warehouse@example.com",
    password: "warehouse123",
    role: "warehouse",
  },
]);
const categories = await Category.create([
  { name: "Electronics", description: "Electronic products" },
  { name: "Accessories", description: "Product accessories" },
]);
await Product.create([
  {
    sku: "ELEC-001",
    name: "Wireless Mouse",
    category: categories[1]._id,
    sellingPrice: 2500,
    stockQuantity: 20,
    reorderLevel: 5,
  },
  {
    sku: "ELEC-002",
    name: "Mechanical Keyboard",
    category: categories[0]._id,
    sellingPrice: 8500,
    stockQuantity: 8,
    reorderLevel: 3,
  },
]);
await Customer.create([
  {
    name: "Ali Traders",
    email: "ali@example.com",
    phone: "03001234567",
    address: "Lahore",
  },
  {
    name: "Zainab Store",
    email: "store@example.com",
    phone: "03111234567",
    address: "Bhera",
  },
]);
console.log("Seed complete", {
  admin: admin.email,
  sales: sales.email,
  warehouse: warehouse.email,
});
process.exit(0);
