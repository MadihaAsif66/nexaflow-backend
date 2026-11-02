
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
let connectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI)
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
}

// Connect database before handling API requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// CUSTOMER SCHEMA
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active"
  }
}, { timestamps: true });

const Customer = mongoose.model("Customer", customerSchema);

// ORDER SCHEMA
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, trim: true },
  customer: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ["Pending", "Processing", "Completed"],
    default: "Pending"
  }
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

// INVENTORY SCHEMA
const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  description: { type: String, default: "" }
}, { timestamps: true });

const Inventory = mongoose.model("Inventory", inventorySchema);

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", application: "NexaFlow" });
});

// CUSTOMER ROUTES
app.get("/api/customers", async (req, res) => {
  try {
    res.json(await Customer.find().sort({ createdAt: -1 }));
  } catch (error) {
    res.status(500).json({ message: "Unable to load customers" });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const { name, email, phone, city, status } = req.body;

    if (![name, email, phone, city].every(
      value => typeof value === "string" && value.trim()
    )) {
      return res.status(400).json({ message: "All customer fields are required" });
    }

    const customer = await Customer.create({
      name, email, phone, city, status: status || "Active"
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ message: "Invalid customer information" });
  }
});

app.put("/api/customers/:id", async (req, res) => {
  try {
    const allowed = ["name", "email", "phone", "city", "status"];
    const updates = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id, updates, { new: true, runValidators: true }
    );

    if (!customer) return res.status(404).json({ message: "Customer not found" });

    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: "Invalid customer update" });
  }
});

app.delete("/api/customers/:id", async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) return res.status(404).json({ message: "Customer not found" });

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: "Invalid customer ID" });
  }
});

// ORDER ROUTES
app.get("/api/orders", async (req, res) => {
  try {
    res.json(await Order.find().sort({ createdAt: -1 }));
  } catch (error) {
    res.status(500).json({ message: "Unable to load orders" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { orderId, customer, amount, status } = req.body;
    const numericAmount = Number(amount);

    if (
      typeof orderId !== "string" || !orderId.trim() ||
      typeof customer !== "string" || !customer.trim() ||
      amount === undefined || amount === "" ||
      !Number.isFinite(numericAmount) || numericAmount < 0
    ) {
      return res.status(400).json({ message: "Please provide valid order details" });
    }

    const order = await Order.create({
      orderId, customer, amount: numericAmount, status: status || "Pending"
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({
      message: "Unable to create order. Check if Order ID already exists."
    });
  }
});

app.put("/api/orders/:id", async (req, res) => {
  try {
    const allowed = ["customer", "amount", "status"];
    const updates = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id, updates, { new: true, runValidators: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: "Invalid order update" });
  }
});

app.delete("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: "Invalid order ID" });
  }
});

// INVENTORY ROUTES
app.get("/api/inventory", async (req, res) => {
  try {
    res.json(await Inventory.find().sort({ createdAt: -1 }));
  } catch (error) {
    res.status(500).json({ message: "Unable to load inventory" });
  }
});

app.post("/api/inventory", async (req, res) => {
  try {
    const { name, price, stock, description } = req.body;
    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (
      typeof name !== "string" || !name.trim() ||
      price === undefined || price === "" ||
      stock === undefined || stock === "" ||
      !Number.isFinite(numericPrice) || numericPrice < 0 ||
      !Number.isFinite(numericStock) || numericStock < 0
    ) {
      return res.status(400).json({ message: "Please provide valid product details" });
    }

    const product = await Inventory.create({
      name, price: numericPrice, stock: numericStock,
      description: description || ""
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: "Unable to create inventory product" });
  }
});

app.put("/api/inventory/:id", async (req, res) => {
  try {
    const allowed = ["name", "price", "stock", "description"];
    const updates = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const product = await Inventory.findByIdAndUpdate(
      req.params.id, updates, { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Inventory product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(400).json({ message: "Invalid inventory update" });
  }
});

app.delete("/api/inventory/:id", async (req, res) => {
  try {
    const product = await Inventory.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Inventory product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: "Invalid inventory product ID" });
  }
});

// Local development
if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Backend running on port ${PORT}`);
      });
    })
    .catch(error => {
      console.error("MongoDB connection failed:", error.message);
    });
}

// Vercel serverless export
module.exports = app;
