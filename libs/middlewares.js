const bodyParser = require('body-parser');

module.exports = app => {
  const port = process.env.PORT || 3000;
  app.set('port', port);
  app.set('json spaces', 4);
  app.use(bodyParser.json());
};
