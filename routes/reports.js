const Report = require('../models/reports.js');

module.exports = app => {
  app.route('/reports')
    .get((req, res) => {
      Report.findAll({})
        .then(result => res.json(result))
        .catch(error => {
          res.status(412).json({msg: error.message});
        });
    })
};
