module.exports = app => {
  app.listen(app.get('port'), () => {
    console.log(`Report API - Port ${app.get('port')}`);
  });
};
