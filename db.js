const mongoose = require('mongoose');

const mongo_uri = process.env.MONGOLAB_URI || 'mongodb://localhost/report';

mongoose.connect(mongo_uri, (err, res) => {
  if(err) {
    console.log('Error connecting to mongo', err);
  } else {
    console.log('Successfully connected to mongo');
  }
});
