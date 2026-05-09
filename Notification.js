const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['success', 'warning', 'error', 'info'], default: 'info' },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  time: { type: String } // We'll store a descriptive string or we can use createdAt
}, { timestamps: true });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
