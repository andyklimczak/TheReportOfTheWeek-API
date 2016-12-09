const mongoose = require('mongoose');
const seeder = require('mongoose-seeder')
const data = require('../fixtures/data.js');
const Report = require('../../models/reports.js');

const mongo_uri = process.env.MONGOLAB_URI || 'mongodb://localhost/report_ci';

describe('Routes: Reports', () => {

  before(done => {
    mongoose.connection.db.dropDatabase();
    Report.insertMany(data, done);
  });

  describe('GET /reports', () => {
    it('returns', done => {
      request.get('/reports')
        .expect(200)
        .end((err, res) => {
          expect(res.body.length).to.eql(5);
          done(err);
        });
    });

    it('returns only specific category', done => {
      request.get('/reports?category=Energy Crisis')
        .expect(200)
        .end((err, res) => {
          expect(res.body.length).to.eql(3);
          done(err);
        });
    });

    it('returns only between specific date', done => {
      request.get('/reports?between=2012-01-01|2013-01-01')
        .expect(200)
        .end((err, res) => {
          expect(res.body.length).to.eql(1);
          done(err);
        });
    });
  });
});
