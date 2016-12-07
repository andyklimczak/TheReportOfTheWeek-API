const Report = require('../models/reports.js');
const MongoQS = require('mongo-querystring');

module.exports = app => {
  app.route('/reports')
  .get((req, res) => {
    const qs = new MongoQS({
      custom: {
        between: 'dateReleased'
      }
    });
    Report.find(qs.parse(req.query)).sort('dateReleased').exec((error, reports) => {
      if(error) {
        res.status(412).json({msg: error.message});
      } else {
        res.json(reports);
      }
    });
  })
};
