const accountService = require('./account-service');
const passwordUtil = require('../common/password-util');

const apiService = {};

// Creates a new API key for the user, replacing any old one. The returned key can't be retrieved
// again later, only its hash is stored.
apiService.createApiKey = async function(username)
{
  const apiKey = passwordUtil.generateApiKey();

  if (!await accountService.setApiKey(username, apiKey))
  {
    throw new Error('user not found');
  }

  return apiKey;
};

module.exports = apiService;
