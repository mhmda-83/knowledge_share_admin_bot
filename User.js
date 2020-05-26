const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
  },
  lastActivityDate: {
    type: Date,
  },
});

module.exports = mongoose.model('User', userSchema);
