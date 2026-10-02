const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const hbs = require('hbs');
const morgan = require('morgan');
const log4js = require('log4js');
const logger = require('./common/logger')(__filename);

// Load .env config
require('dotenv').config();

// Initialize logging
logger.info('Starting application...');

const handlebarsExtensions = require('./common/handlerbars-extensions');

const authentication = require('./middlewares/authentication');
const baseViewModel = require('./middlewares/base-view-model');

const homeRouter = require('./routes/home-router');
const accountRouter = require('./routes/account-router');
const leaderboardRouter = require('./routes/leaderboard-router');
const apiRouter = require('./routes/api-router');
const adminRouter = require('./routes/admin-router');

const app = express();

if (process.env.TRUST_PROXY)
{
  app.set('trust proxy', process.env.TRUST_PROXY);
}

// handlebars setup
hbs.registerPartials(__dirname + '/views/partials', function (err) {});
handlebarsExtensions.register(hbs);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// TODO: use AsyncLocalStorage to persist request details for logging

// http logging to console (helpful for dev)
//app.use(morgan('dev'));

// full http access log
app.use(log4js.connectLogger(log4js.getLogger('http'), { level: 'auto' }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// user authentication
app.use(authentication.authenticate);

// base view model (adds common items to res.locals)
app.use(baseViewModel.handleRequest);

app.use('/', homeRouter);
app.use('/account', accountRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/api', apiRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next)
{
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next)
{
  // Check for 404 error
  if (err.status == 404)
  {
    logger.warn(`404 error: ${req.originalUrl}, ${req.headers['user-agent']}`);
  }
  else
  {
    logger.error('Unhandled exception:', err);
  }

  // render the error page
  res.status(err.status || 500);
  res.render('error', { layout: null });
});

module.exports = app;
