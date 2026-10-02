const config = require('../config/config');
const extensionService = require('../services/extension-service');

// Middleware for selecting the leaderboard extension from the host name

const extension = {};

extension.handleRequest = async function(req, res, next)
{
  // Extension is the leftmost part of the host name, e.g. "ext" in "ext.deertier.com".
  // Hosts that don't match an extension (www, localhost, IP addresses, ...) use the default extension.
  const extensionName = req.hostname?.split('.')[0];

  const currentExtension = await extensionService.getExtension(extensionName)
    ?? await extensionService.getDefaultExtension();

  if (!currentExtension)
  {
    throw new Error(`Default extension not found: [${config.defaultExtension}]`);
  }

  res.locals.Extension = currentExtension;
  next();
};

module.exports = extension;
