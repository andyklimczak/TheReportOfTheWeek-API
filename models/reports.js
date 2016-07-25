import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  product: String,
  manufacturer: String,
  category: String,
  videoTitle: String,
  videoCode: String,
  dateReleased: Date,
  rating: { type: Number, min: 1, max: 10 },
  effectiveness: Number
});

module.exports = mongoose.model('Report', reportSchema);
