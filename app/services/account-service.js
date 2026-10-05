const utils = require('../common/utils');
const passwordUtil = require('../common/password-util');
const ModeratorType = require('../common/moderator-type');
const accountRepository = require('../data/account-repository');
const leaderboardRepository = require('../data/leaderboard-repository');
const moderationService = require('./moderation-service');

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

accountService.getStaff = async function()
{
  return await accountRepository.getStaff();
};

// Display names of a user's roles, e.g. [ 'Administrator', 'Hidden moderator' ]
accountService.getRoleNames = function(user)
{
  return [
    user.IsAdministrator && 'Administrator',
    user.IsModerator == ModeratorType.Moderator && 'Moderator',
    user.IsModerator == ModeratorType.HiddenModerator && 'Hidden moderator'
  ].filter(Boolean);
};

accountService.setUserRoles = async function(userContext, user, moderatorType, isAdministrator)
{
  if (!userContext.user)
    throw new Error('Log in as an administrator to change roles.');

  if (!Object.values(ModeratorType).includes(moderatorType))
    throw new Error('Choose a moderator role.');

  await accountRepository.setUserRoles(user.ID, moderatorType, isAdministrator);

  const roleNames = accountService.getRoleNames({ IsModerator: moderatorType, IsAdministrator: isAdministrator });
  await moderationService.logChangeUserRoles(userContext, user, roleNames);
};

accountService.getUserByApiKey = async function(apiKey)
{
  if (utils.isNullOrWhitespace(apiKey))
  {
    return null;
  }

  return await accountRepository.getUserByApiKeyHash(passwordUtil.hashApiKey(apiKey));
};

// Store the hash of the API key instead of the key
accountService.setApiKey = async function(username, apiKey)
{
  return await accountRepository.setApiKeyHash(username, passwordUtil.hashApiKey(apiKey));
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

accountService.getAdmins = async function()
{
  return await accountRepository.getAdmins();
};

accountService.getMyRecords = async function(userContext)
{
  return await leaderboardRepository.getAllRecordsByUsername(userContext.user.Name);
};

module.exports = accountService;
