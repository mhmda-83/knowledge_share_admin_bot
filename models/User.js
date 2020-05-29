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
  numberOfLearnedThings: {
    type: Number,
    default: 0,
  },
  numberOfTaughtThings: {
    type: Number,
    default: 0,
  },
  lastActivityDate: {
    type: Date,
  },
});

module.exports = mongoose.model('User', userSchema);
