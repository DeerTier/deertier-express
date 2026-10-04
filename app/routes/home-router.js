const express = require('express');
const config = require('../config/config');
const utils = require('../common/utils');
const accountService = require('../services/account-service');
const webContentService = require('../services/web-content-service');
const logger = require('../common/logger')(__filename);

const router = express.Router();

// Homepage
// ----------------------------------------------------------------------------

// Names as HTML, e.g. "a, b and c" (escaped, since usernames can contain any characters)
function formatNames(names)
{
  names = names.map(utils.escapeHtml);

  let formattedText = '';
  for (let i = 0; i < names.length; i++)
  {
    if (i == names.length - 2)
    {
      formattedText += names[i] + ' and ';
    }
    else if (i == names.length - 1)
    {
      formattedText += names[i];
    }
    else
    {
      formattedText += names[i] + ', ';
    }
  }
  return formattedText;
}

router.get('/', async function(req, res, next)
{
  const admins = (await accountService.getAdmins())
    .sort(new Intl.Collator().compare);

  const moderators = (await accountService.getModerators())
    .sort(new Intl.Collator().compare)
    .filter(name => !admins.includes(name));

  let moderatorsText = formatNames(moderators);
  let adminsText = formatNames(admins);

  const viewModel = {};
  viewModel.Title = 'Home';
  viewModel.EmbeddedHtmlContent = await getHomepageContent();
  viewModel.FormattedModerators = moderatorsText;
  viewModel.FormattedAdmins = adminsText;
  viewModel.DiscordUrl = config.discordUrl;

  res.render('home/index', viewModel);
});

async function getHomepageContent()
{
  try
  {
    const homepageContent = await webContentService.getContent(config.homepageContentUrl);
    if (utils.isNullOrWhitespace(homepageContent))
    {
      throw new Error('No homepage content');
    }
    return homepageContent;
  }
  catch (ex)
  {
    logger.error('Failed to get homepage content', ex);
    return '[Failed to load homepage content.]';
  }
}

// News
// ----------------------------------------------------------------------------

router.get('/news', async function(req, res, next)
{
  const viewModel = {};
  viewModel.Title = 'News';

  res.render('home/news', viewModel);
});

module.exports = router;
