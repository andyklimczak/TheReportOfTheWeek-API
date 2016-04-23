const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  product: String,
  company: String,
  category: String,
  videoTitle: String,
  videoCode: String,
  dateReleased: Date,
  rating: { type: Number, min: 1, max: 10 }
});

module.exports = mongoose.model('Report', reportSchema);
