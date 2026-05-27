import './instrument';
import { configs } from '../config/config.env';
import { Bootstrap } from './bootstrap';

const app = new Bootstrap({
  server_port: configs.SERVER_PORT,
  server_name: configs.SERVER_NAME,
  emoji: configs.ENV_EMOJI,
  env: configs.NODE_ENV,
  routes_to_exclude: ['auth/admin', 'auth/customer-x-token'],
  logger: {
    // Logger should be setup in a SINGLETON manner. It should be accessible to all services, controllers, modules.
    provider: 'PINO',
  },
});

app.init();
