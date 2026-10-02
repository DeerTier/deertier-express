const createError = require('http-errors');
const logger = require('../common/logger')(__filename);

// Middleware for rejecting cross-site form posts (CSRF). Browsers send an Origin header with
// POST requests, so a request changing data must come from a page on this same host.

const requestOrigin = {};

const safeMethods = [ 'GET', 'HEAD', 'OPTIONS' ];

requestOrigin.handleRequest = function(req, res, next)
{
  const origin = req.headers.origin;

  // Requests without an Origin header don't come from a browser form on another site
  if (safeMethods.includes(req.method) || origin === undefined)
  {
    next();
    return;
  }

  if (getOriginHost(origin) !== req.headers.host)
  {
    logger.warn(`Rejected cross-origin request: [${req.method}], [${req.originalUrl}], origin [${origin}], host [${req.headers.host}]`);
    next(createError(403));
    return;
  }

  next();
};

// Returns the host (including port) of an Origin header, or null for "null" and invalid values
function getOriginHost(origin)
{
  try
  {
    return new URL(origin).host;
  }
  catch (ex)
  {
    return null;
  }
}

module.exports = requestOrigin;
