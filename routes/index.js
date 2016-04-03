module.exports = app => {
  app.get('/', (req, res) => {
    res.json({status: 'Report API'});
  });
};
