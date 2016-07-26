const Report = require('../models/reports.js');

module.exports = app => {
  app.route('/reports')
  .get((req, res) => {
    Report.find({}, (err, reports) => {
      if(err) {
        res.status(412).json({msg: error.message});
      } else {
        res.json(reports);
      }
    });
  })
};
