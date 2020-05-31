const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
  },
  senderId: {
    type: Number,
    required: true,
  },
  learnerId: {
    type: Number,
    required: true,
  },
  learnDate: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model('Message', messageSchema);
