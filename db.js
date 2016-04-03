const mongoose = require('mongoose');

const mongo_uri = 'mongodb://localhost/report';

mongoose.connect(mongo_uri, (err, res) => {
  if(err) {
    console.log('error', err);
  } else {
    console.log('mongo connect success');
  }
});
