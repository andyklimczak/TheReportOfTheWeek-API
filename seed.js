const seeder = require('mongoose-seeder')
const data = require('./seeds/reports.json');
const Report = require('./models/reports.js');

const mongoose = require('mongoose');

const mongo_uri = process.env.MONGOLAB_URI || 'mongodb://localhost/report';

mongoose.connect(mongo_uri, (err, res) => {
  if(err) {
    console.log('Error connecting to mongo', err);
  } else {
    console.log('Seeding data');
    seeder.seed(data, {dropCollections: true}).then(function(dbData) {
      mongoose.disconnect();
      console.log('Seeding data complete');
    }).catch(function(err) {
      console.log('Could not seed data', err);
    });
  }
});
