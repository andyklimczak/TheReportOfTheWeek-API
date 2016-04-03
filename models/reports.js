const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: String
});

module.exports = mongoose.model('Report', reportSchema);
