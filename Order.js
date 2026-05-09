const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: { type: String, required: true, default: 'Guest' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    quantity: { type: Number, default: 1 },
    price: Number
  }],
  total: { type: Number, required: true, default: 0 },
  status: { type: String, required: true, default: 'Pending', enum: ['Pending', 'Completed', 'Cancelled'] },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
