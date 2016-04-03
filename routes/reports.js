module.exports = app => {
  const Reports = app.models.reports;
  app.get('/reports', (req, res) => {
    Reports.findAll({}, (reports) => {
      res.json({reports});
    });
  });
};
