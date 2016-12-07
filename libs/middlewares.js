import bodyParser from 'body-parser';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';

module.exports = app => {
  const port = process.env.PORT || 3001;
  app.set('port', port);
  app.set('json spaces', 4);
  app.use(bodyParser.json());
  app.use(cors({
    methods: ["GET"],
    allowedHeaders: ["Content-Type"]
  }));
  app.use(compression());
  app.use(helmet());
};
