const jwt = require('jsonwebtoken');
const config = require('../config/config');
const utils = require('../common/utils');
const ModeratorType = require('../common/moderator-type');
const accountService = require('../services/account-service');

const authentication = {};

// Separate cookie name on the preview site, so a production cookie shared with subdomains
// (cookieDomain) doesn't shadow the preview site's own login
const authTokenCookie = (config.isPreviewSite ? 'authtoken_preview' : 'authtoken');
const authTokenCookieLifetime = 60 * 60 * 24 * 365 * 1000;

authentication.createToken = function(req, res, username)
{
  const token = jwt.sign(username, config.jwtSecret);
  clearHostOnlyToken(res);
  res.cookie(authTokenCookie, token, { maxAge: authTokenCookieLifetime, httpOnly:true, sameSite: 'lax', domain: config.cookieDomain });
  req.username = username;
};

authentication.destroyToken = function(req, res)
{
  clearHostOnlyToken(res);
  res.clearCookie(authTokenCookie, { domain: config.cookieDomain });
  req.username = null;
};

// Remove a host-only cookie left over from before cookieDomain was configured,
// so it doesn't shadow the shared cookie
function clearHostOnlyToken(res)
{
  if (config.cookieDomain)
  {
    res.clearCookie(authTokenCookie);
  }
}

authentication.authenticate = async function(req, res, next)
{

  // Check if we're on an API path, and if so, authenticate using the API key instead of the login cookie
  req.isApiRequest = isApiPath(req.path);
  if (req.isApiRequest)
  {
    await authenticateApiKey(req, res, next);
    return;
  }

  const token = req.cookies[authTokenCookie];
  if (token == null)
  {
    next();
    return;
  }

  jwt.verify(token, config.jwtSecret, (err, username) =>
  {
    if (!err)
    {
      req.username = username;
    }

    next();
  });
};

async function authenticateApiKey(req, res, next)
{
  const apiKey = getApiKey(req);

  // No API key provided, continue unauthenticated
  if (apiKey == null)
  {
    next();
    return;
  }

  const user = await accountService.getUserByApiKey(apiKey);
  if (!user)
  {
    res.status(401).json({ error: 'invalid api key' });
    return;
  }

  req.username = user.Name;
  req.user = user;
  next();
}

function isApiPath(path)
{
  const lowerPath = path.toLowerCase();
  return (lowerPath === '/api' || lowerPath.startsWith('/api/'));
}

function getApiKey(req)
{
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
  return match?.[1] ?? null;
}

authentication.authorize = function(req, res, next)
{
  if (req.username)
  {
    next();
  }
  else
  {
    denyAccess(req, res, null);
  }
};

// Admin key only. For GET requests that change data, which a logged in administrator could be
// tricked into opening from another site.
authentication.authorizeAdminKey = function(req, res, next)
{
  if (hasAdminKey(req))
  {
    next();
  }
  else
  {
    res.send('unauthorized access');
  }
};

// Admin key or a logged in administrator
authentication.authorizeAdmin = async function(req, res, next)
{
  if (hasAdminKey(req))
  {
    next();
    return;
  }

  // Or a logged in administrator
  const user = await accountService.getAuthenticatedUser(req);
  if (user?.IsAdministrator)
  {
    next();
  }
  else
  {
    denyAccess(req, res, user);
  }
};

// A logged in moderator or administrator.
authentication.authorizeModerator = async function(req, res, next)
{
  const user = await accountService.getAuthenticatedUser(req);
  if (user && (user.IsModerator != ModeratorType.NotModerator || user.IsAdministrator))
  {
    next();
  }
  else
  {
    denyAccess(req, res, user);
  }
};

// API requests get a status code. Page requests go to the login page when not logged in.
function denyAccess(req, res, user)
{
  if (req.isApiRequest)
  {
    res.status(user ? 403 : 401).json({ error: (user ? 'forbidden' : 'unauthorized') });
  }
  else if (!user)
  {
    const returnUrl = req.originalUrl;
    res.redirect(`/account/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  }
  else
  {
    res.send('unauthorized access');
  }
}

// Verify adminKey in request query
function hasAdminKey(req)
{
  return (!utils.isNullOrWhitespace(config.adminKey) &&
    req.query.adminKey == config.adminKey);
}

module.exports = authentication;
