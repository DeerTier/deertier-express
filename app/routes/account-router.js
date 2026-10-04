const express = require('express');
const authentication = require('../middlewares/authentication');
const accountService = require('../services/account-service');
const leaderboardService = require('../services/leaderboard-service');
const utils = require('../common/utils');
const RecordStatus = require('../common/record-status');
const logger = require('../common/logger')(__filename);

const router = express.Router();

// My records
// ----------------------------------------------------------------------------
router.get('/myRecords', authentication.authorize, async function(req, res)
{
  const userContext = await accountService.getUserContext(req);
  const records = await accountService.getMyRecords(userContext);

  // The records currently on a leaderboard, the same way the leaderboard picks them
  const leaderboardRecordIds = await leaderboardService.getLeaderboardRecordIds(records);

  const recordModels = (await leaderboardService.getRecordModels(records)).map(record =>
  {
    return {
      ...record,
      // Dimmed when not live: approved records beaten by a better one, and deleted records
      IsDimmed: (record.Status === RecordStatus.Approved && !leaderboardRecordIds.has(record.ID))
        || record.Status === RecordStatus.Deleted
    };
  });

  const viewModel = {};
  viewModel.Title = 'My Submitted Records';
  viewModel.Records = recordModels;
  res.render('account/myRecords', viewModel);
});


// Log in
// ----------------------------------------------------------------------------

router.get('/login', async function(req, res)
{
  if (await accountService.isAuthenticated(req))
  {
    return res.redirect('/');
  }

  return renderLoginView(res);
});

router.post('/login', async function(req, res)
{
  const { username, password } = req.body;

  if (utils.isNullOrWhitespace(username) || utils.isNullOrWhitespace(password))
  {
    return renderLoginView(res, 'Please complete all of the fields');
  }

  const user = await accountService.getUser(username);

  // Ensure user exists
  if (!user)
  {
    return renderLoginView(res, 'Username does not exist');
  }

  // Check password
  if (!accountService.verifyPassword(user, password))
  {
    return renderLoginView(res, 'Incorrect password');
  }

  authentication.createToken(req, res, username);

  logger.debug(`User logged in: [${username}]`);

  const redirectUrl = req.query.returnUrl || '/';
  res.redirect(redirectUrl);
});

function renderLoginView(res, message)
{
  const viewModel = {};
  viewModel.Title = 'Log In';
  viewModel.Message = message;
  res.render('account/login', viewModel);
}

// Log out
// ----------------------------------------------------------------------------

router.get('/logout', function(req, res)
{
  logger.debug(`User logged out: [${req.username}]`);

  authentication.destroyToken(req, res);

  const redirectUrl = req.query.returnUrl || '/';
  res.redirect(redirectUrl);
});

// Sign up
// ----------------------------------------------------------------------------

router.get('/signup', async function(req, res)
{
  if (await accountService.isAuthenticated(req))
  {
    return res.redirect('/');
  }

  return renderSignUpView(res);
});

router.post('/signup', async function(req, res)
{
  const { username, password, confirmedPassword } = req.body;

  if (utils.isNullOrWhitespace(username) || utils.isNullOrWhitespace(password) || utils.isNullOrWhitespace(confirmedPassword))
  {
    return renderSignUpView(res, 'Please complete all of the fields');
  }

  if (password != confirmedPassword)
  {
    return renderSignUpView(res, 'Passwords do not match');
  }

  if (await accountService.userExists(username))
  {
    return renderSignUpView(res, 'Username already exists');
  }

  await accountService.addUser(username, password);

  authentication.createToken(req, res, username);

  logger.debug(`User signed up: [${username}]`);

  return renderSuccessView(res, 'Registration successful!');
});

function renderSignUpView(res, message)
{
  const viewModel = {};
  viewModel.Title = 'Sign Up';
  viewModel.Message = message;
  res.render('account/signup', viewModel);
}

// Change password
// ----------------------------------------------------------------------------

router.get('/changepassword', authentication.authorize, function(req, res)
{
  return renderChangePasswordView(res);
});

router.post('/changepassword', authentication.authorize, async function(req, res)
{
  const { currentPassword, newPassword, confirmedNewPassword } = req.body;

  if (utils.isNullOrWhitespace(currentPassword) || utils.isNullOrWhitespace(newPassword) || utils.isNullOrWhitespace(confirmedNewPassword))
  {
    return renderChangePasswordView(res, 'Please complete all of the fields');
  }

  if (newPassword != confirmedNewPassword)
  {
    return renderChangePasswordView(res, 'New passwords do not match');
  }

  const user = await accountService.getAuthenticatedUser(req);

  if (!accountService.verifyPassword(user, currentPassword))
  {
    return renderChangePasswordView(res, 'Current password is incorrect');
  }

  if (!await accountService.changePassword(user.Name, newPassword))
  {
    return renderChangePasswordView(res, 'Something went wrong while changing your password. Please try again.');
  }

  return renderSuccessView(res, 'Your password has been changed.', 'Change Password Success');
});

function renderChangePasswordView(res, message)
{
  const viewModel = {};
  viewModel.Title = 'Change Password';
  viewModel.Message = message;
  res.render('account/changePassword', viewModel);
}

// Reset password
// ----------------------------------------------------------------------------

router.get('/resetpassword', authentication.authorizeAdminKey, async function(req, res)
{
  const { username } = req.query;
  const newPassword = await accountService.resetPassword(username);

  logger.debug(`Password has been reset for user: [${username}]`);

  res.send(newPassword);
});

// Set administrator
// ----------------------------------------------------------------------------

router.get('/setadministrator', authentication.authorizeAdminKey, async function(req, res)
{
  // enabled=0 removes administrator rights, anything else grants them
  const { username, enabled } = req.query;
  const isAdministrator = (enabled !== '0');

  if (!await accountService.setAdministrator(username, isAdministrator))
  {
    return res.send(`user not found: ${username}`);
  }

  logger.info(`Administrator rights ${isAdministrator ? 'granted to' : 'removed from'} user: [${username}]`);

  res.send(`${username} IsAdministrator=${isAdministrator}`);
});

// ----------------------------------------------------------------------------

function renderSuccessView(res, message, title)
{
  const viewModel = {};
  viewModel.Title = title ?? 'Success';
  viewModel.Message = message;
  res.render('account/success', viewModel);
}

module.exports = router;
