const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');

// Import Models
const Product = require('./models/Product');
const Order = require('./models/Order');
const Supplier = require('./models/Supplier');
const Notification = require('./models/Notification');
const User = require('./models/User');
const InventoryLog = require('./models/InventoryLog');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/invenmang')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Dashboard Stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const allProducts = await Product.find({}, 'stock threshold category');
    const lowStock = allProducts.filter(p => p.stock <= p.threshold).length;
    const totalOrders = await Order.countDocuments();
    
    // Calculate total revenue from all non-cancelled orders
    const orders = await Order.find({ status: { $ne: 'Cancelled' } });
    const revenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    
    const categoryCounts = allProducts.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalProducts,
      lowStock,
      totalOrders,
      revenue,
      chartData: {
        categories: {
          labels: Object.keys(categoryCounts),
          data: Object.values(categoryCounts)
        },
        sales: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          data: [1200, 1900, 1500, 2200, 1800, 2800, revenue]
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    const mapped = products.map(p => ({
      ...p.toObject(),
      id: p._id
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json({ ...newProduct.toObject(), id: newProduct._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    // Check if stock changed to create a log
    const oldStock = product.stock;
    const newStock = parseInt(req.body.stock, 10);
    
    product.name = req.body.name;
    product.sku = req.body.sku;
    product.category = req.body.category;
    product.price = parseFloat(req.body.price);
    product.stock = newStock;
    product.threshold = parseInt(req.body.threshold, 10);
    
    await product.save();

    if (oldStock !== newStock) {
      const type = newStock > oldStock ? 'Stock In' : 'Stock Out';
      const log = new InventoryLog({
        product: product._id,
        sku: product.sku,
        type: type,
        quantityChanged: Math.abs(newStock - oldStock),
        reason: 'Manual Edit',
        user: 'Admin User'
      });
      await log.save();
    }
    
    res.json({ success: true, product: { ...product.toObject(), id: product._id } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    const mapped = orders.map(o => {
      const obj = o.toObject();
      return {
        ...obj,
        id: obj._id,
        date: obj.date ? new Date(obj.date).toISOString().split('T')[0] : ''
      };
    });
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { customer, items, total } = req.body;
    const newOrder = new Order({
      customer: customer || 'Guest',
      items: items || [],
      total: total || 0,
      status: 'Pending',
      date: new Date()
    });
    await newOrder.save();
    
    // Deduct stock and check thresholds
    if (items && items.length > 0) {
      for (let item of items) {
        if (item.product) {
          const product = await Product.findById(item.product);
          if (product) {
            product.stock -= item.quantity;
            await product.save();
            
            // Create Inventory Log
            const log = new InventoryLog({
              product: product._id,
              sku: product.sku,
              type: 'Stock Out',
              quantityChanged: item.quantity,
              reason: `Order #${newOrder._id.toString().slice(-4)}`,
              user: newOrder.customer
            });
            await log.save();
            
            if (product.stock <= product.threshold) {
              const notif = new Notification({
                type: 'warning',
                message: `${product.name} stock is critically low (${product.stock} units remain)`,
                time: "Just now"
              });
              await notif.save();
            }
          }
        }
      }
    }
    
    res.status(201).json({ ...newOrder.toObject(), id: newOrder._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = req.body.status;
    await order.save();
    res.json({ success: true, order: { ...order.toObject(), id: order._id } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Suppliers
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 });
    res.json(suppliers.map(s => ({ ...s.toObject(), id: s._id })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const newSupplier = new Supplier({ ...req.body, status: 'Active' });
    await newSupplier.save();
    res.status(201).json({ ...newSupplier.toObject(), id: newSupplier._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id, 
      { ...req.body }, 
      { new: true }
    );
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ success: true, supplier: { ...supplier.toObject(), id: supplier._id } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// Notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications.map(n => ({ ...n.toObject(), id: n._id })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications/read', async (req, res) => {
  try {
    await Notification.updateMany({ read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Inventory Logs
app.get('/api/inventory-logs', async (req, res) => {
  try {
    const logs = await InventoryLog.find().sort({ createdAt: -1 });
    res.json(logs.map(l => ({ ...l.toObject(), id: l._id })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory logs' });
  }
});

// User Profile
app.put('/api/profile', async (req, res) => {
  try {
    let user = await User.findOne();
    if (!user) {
      user = new User({ name: 'Admin Route', email: 'admin@route.com', password: 'password', role: 'admin' });
      await user.save();
    }
    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;
    await user.save();
    res.json({ success: true, user: { ...user.toObject(), id: user._id } });
  } catch(error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Export mock
app.get('/api/export', (req, res) => {
  setTimeout(() => res.json({ success: true, fileUrl: '#' }), 1500);
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });
    
    // Auto-seed for testing if no users exist
    if (!user && await User.countDocuments() === 0) {
       user = new User({ name: 'Admin', email: email || 'admin@admin.com', password: password || 'password', role: 'admin' });
       await user.save();
    }

    if (user && user.password === password) {
      res.json({ token: 'mock-jwt-token-123', user: { name: user.name, role: user.role, email: user.email } });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch(error) {
    res.status(500).json({ error: 'Server auth error' });
  }
});

// SPA catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
