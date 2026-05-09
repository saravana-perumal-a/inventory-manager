const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  sku: { type: String, required: true },
  type: { type: String, required: true, enum: ['Stock In', 'Stock Out'] },
  quantityChanged: { type: Number, required: true }, // Should be pos/neg but we can use abs value alongside type
  reason: { type: String, required: true },
  user: { type: String, default: 'System' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.InventoryLog || mongoose.model('InventoryLog', inventoryLogSchema);
