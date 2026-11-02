const dns = require("node:dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);


require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Customer database structure
const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active"
    }
  },
  { timestamps: true }
);

const Customer = mongoose.model(
  "Customer",
  customerSchema
);

// Backend health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    application: "NexaFlow"
  });
});

// GET all customers
app.get("/api/customers", async (req, res) => {
  try {
    const customers = await Customer.find()
      .sort({ createdAt: -1 });

    res.json(customers);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load customers"
    });
  }
});

// POST create customer
app.post("/api/customers", async (req, res) => {
  try {
    const { name, email, phone, city, status } = req.body;

    if (![name, email, phone, city].every(
      (value) =>
        typeof value === "string" && value.trim()
    )) {
      return res.status(400).json({
        message: "All customer fields are required"
      });
    }

    const customer = await Customer.create({
      name,
      email,
      phone,
      city,
      status: status || "Active"
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({
      message: "Invalid customer information"
    });
  }
});

// PUT update customer
app.put("/api/customers/:id", async (req, res) => {
  try {
    const allowed = [
      "name", "email", "phone", "city", "status"
    ];

    const updates = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    res.json(customer);
  } catch (error) {
    res.status(400).json({
      message: "Invalid customer update"
    });
  }
});

// DELETE customer
app.delete("/api/customers/:id", async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(
      req.params.id
    );

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    res.json({
      message: "Customer deleted successfully"
    });
  } catch (error) {
    res.status(400).json({
      message: "Invalid customer ID"
    });
  }
});

// MongoDB Atlas connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Atlas connected");

    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed:",
      error.message
    );
  });