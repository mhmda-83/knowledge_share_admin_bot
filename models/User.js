const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true,
  },
  joinDate: {
    type: Date,
    default: Date.now,
  },
  lastActivityDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model('User', userSchema);
