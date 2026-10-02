const utils = require('../common/utils');
const passwordUtil = require('../common/password-util');
const ModeratorType = require('../common/moderator-type');
const accountRepository = require('../data/account-repository');

const accountService = {};

accountService.userExists = async function(username)
{
  if (utils.isNullOrWhitespace(username))
  {
    return false;
  }

  return await accountRepository.userExists(username);
};

accountService.verifyPassword = function(user, password)
{
  return passwordUtil.verifyHashedPassword(user.Password, password, user.PasswordType);
};

accountService.getUser = async function(username)
{
  return await accountRepository.getUser(username);
};

accountService.getAuthenticatedUser = async function(req)
{
  // Ensure request is authenticated
  if (!req || utils.isNullOrWhitespace(req.username))
    return null;

  // Check for cached user object on request
  if (req.user)
    return req.user;

  // Load user from repository
  req.user = await accountService.getUser(req.username);
  return req.user;
};

accountService.isAuthenticated = async function(req)
{
  const user = await accountService.getAuthenticatedUser(req);
  return !!user;
};


accountService.getUserContext = async function(req)
{
  const userContext = {};

  userContext.user = await accountService.getAuthenticatedUser(req);
  userContext.ipAddress = req.ip;
  userContext.userAgent = req.headers['user-agent'];

  return userContext;
};

accountService.addUser = async function(username, password)
{
  const { hashedPassword, passwordType } = passwordUtil.hashNewPassword(password);

  const user =
  {
    Name: username,
    Password: hashedPassword,
    PasswordType: passwordType,
    IsModerator: ModeratorType.NotModerator,
    IsAdministrator: false
  };

  await accountRepository.addUser(user);
};

accountService.changePassword = async function(username, newPassword)
{
  const { hashedPassword, passwordType } = passwordUtil.hashNewPassword(newPassword);
  return await accountRepository.changePassword(username, hashedPassword, passwordType);
};

accountService.setAdministrator = async function(username, isAdministrator)
{
  if (utils.isNullOrWhitespace(username))
  {
    return false;
  }

  return await accountRepository.setAdministrator(username, isAdministrator);
};

accountService.resetPassword = async function(username)
{
  const newPassword = passwordUtil.generateRandomPassword();
  await accountService.changePassword(username, newPassword);
  return newPassword;
};

accountService.getModerators = async function()
{
  return await accountRepository.getModerators();
};

module.exports = accountService;
