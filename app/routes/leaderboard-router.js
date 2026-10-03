const express = require('express');
const utils = require('../common/utils');
const recordUtil = require('../common/record-util');
const ModeratorType = require('../common/moderator-type');
const RecordStatus = require('../common/record-status');
const authentication = require('../middlewares/authentication');
const categoryService = require('../services/category-service');
const leaderboardService = require('../services/leaderboard-service');
const accountService = require('../services/account-service');
const logger = require('../common/logger')(__filename);

const router = express.Router();

// Category leaderboard
// ----------------------------------------------------------------------------

router.get('/:categoryUrlName', async function(req, res)
{
  const category = await categoryService.getCategoryByUrlName(req.params.categoryUrlName, res.locals.Extension.Id);

  if (!category)
  {
    return res.sendStatus(404);
  }

  const categoryModel = await categoryService.getCategoryModel(category.Id);

  const viewModel = {};
  viewModel.Title = categoryModel.FullName;
  viewModel.Category = categoryModel;
  viewModel.HideRecordsWithoutVideo = (req.query.hideRecordsWithoutVideo == 1);

  if (category.Parent)
  {
    viewModel.SectionHeading = category.Parent.Section?.Name;
    viewModel.Heading = category.Parent.Name;

    // Hidden subcategories are only reachable by direct link, so they only get a tab while viewing them
    viewModel.SiblingCategories = await Promise.all(
      category.Parent.Subcategories
        .filter(c => c.Visible || c === category)
        .map(async c => await categoryService.getCategoryModel(c.Id))
    );
  }
  else
  {
    viewModel.SectionHeading = category.Section?.Name;
    viewModel.Heading = category.Name;
  }

  const records = await leaderboardService.getRecords(category, viewModel.HideRecordsWithoutVideo);
  const rankedRecords = rankRecords(records, r => recordUtil.getRankKey(category, r));

  viewModel.Records = rankedRecords
    .map(r => mapRecord(r, category));

  res.render('leaderboard/index', viewModel);
});

// Rank records using standard competitive ranking ("1224" ranking)
function rankRecords(records, recordRankKey)
{
  if (records.length == 0)
  {
    return records;
  }

  const rankedRecords = records.map(r =>
  ({
    Record: r,
    Rank: 1
  }));

  let lastRank = 1;
  let lastRankKey = recordRankKey(records[0]);

  for (let i = 1; i < rankedRecords.length; i++)
  {
    let r = rankedRecords[i];
    let rankKey = recordRankKey(r.Record);

    if (rankKey == lastRankKey)
    {
      r.Rank = lastRank;
    }
    else
    {
      lastRankKey = rankKey;
      r.Rank = i + 1;
      lastRank = r.Rank;
    }
  }

  return rankedRecords;
}

function mapRecord(rankedRecord, category)
{
  const record = rankedRecord.Record;

  const recordModel =
  {
    Id: record.ID,
    Player: record.Player,
    RealTimeSeconds: record.RealTimeSeconds,
    GameTimeSeconds: record.GameTimeSeconds,
    Comment: record.Comment,
    VideoURL: record.VideoURL,
    VideoURLAsLink: recordUtil.formatVideoURLAsLink(record.VideoURL),
    CeresTime: record.CeresTime,
    DateSubmitted: record.DateSubmitted,
    DateSubmittedAsString: recordUtil.formatDateSubmitted(record.DateSubmitted),
    DateSubmittedSortOrder: recordUtil.getDateSubmittedSortOrder(record.DateSubmitted),
    Rank: rankedRecord.Rank,
    RankClass: getRankClass(rankedRecord.Rank)
  };

  if (category.RealTime)
  {
    recordModel.FormattedRealTime = recordUtil.getFormattedRealTime(record.RealTimeSeconds);
  }

  if (category.GameTime)
  {
    recordModel.FormattedGameTime = recordUtil.getFormattedGameTime(record.GameTimeSeconds);
  }

  if (category.EscapeGameTime)
  {
    recordModel.FormattedEscapeGameTime = recordUtil.getFormattedEscapeGameTime(record.CeresTime);
  }

  recordModel.HtmlComment = recordUtil.formatCommentAsHtml(record.Comment);

  return recordModel;
}

function getRankClass(rank)
{
  switch (rank)
  {
    case 1:
      return 'gold';
    case 2:
      return 'silver';
    case 3:
      return 'bronze';
    default:
      return null;
  }
}

// Submit record
// ----------------------------------------------------------------------------

router.get('/:categoryUrlName/submit', authentication.authorize, async function(req, res)
{
  const category = await categoryService.getCategoryByUrlName(req.params.categoryUrlName, res.locals.Extension.Id);

  if (!category)
  {
    return res.sendStatus(404);
  }

  await renderSubmitTimeView(res, category);
});

router.post('/:categoryUrlName/submit', authentication.authorize, async function(req, res)
{
  const categoryUrlName = req.params.categoryUrlName;
  const category = await categoryService.getCategoryByUrlName(categoryUrlName, res.locals.Extension.Id);

  if (!category)
  {
    return res.sendStatus(404);
  }

  const { gameTime, escapeGameTime, realTime, videoLink, comment } = req.body;
  let { username } = req.body;

  if ((category.GameTime && utils.isNullOrWhitespace(gameTime))
    || (category.EscapeGameTime && utils.isNullOrWhitespace(escapeGameTime))
    || (category.RealTime && utils.isNullOrWhitespace(realTime)))
  {
    return await renderSubmitTimeView(res, category, 'Please fill out the time fields');
  }

  const userContext = await accountService.getUserContext(req);
  let isModeratorAction = false;

  // Auto-approve runs a moderator submits for someone else.
  if (userContext.user.IsModerator && !utils.isNullOrWhitespace(username)
    && username.trim().toLowerCase() !== userContext.user.Name.toLowerCase())
  {
    username = username.trim();
    isModeratorAction = true;

    logger.info(`Moderator submitting record for another user: [${username}]`);
  }
  else
  {
    username = userContext.user.Name;
  }

  const record = recordUtil.createRecord(category, username, gameTime, escapeGameTime, realTime, videoLink, comment, userContext.user.ID);
  if (!record)
  {
    return renderSubmitTimeView(res, category, 'Invalid time');
  }

  record.Status = await leaderboardService.getNewRecordStatus(category, record, isModeratorAction);

  await leaderboardService.addRecord(userContext, record, isModeratorAction);

  logger.debug(`Record submitted: [${categoryUrlName}], [${gameTime ?? ''}], [${escapeGameTime ?? ''}], [${realTime ?? ''}], [${videoLink}], [${comment}]`);

  const viewModel = {};
  viewModel.Title = 'Success';
  viewModel.IsPending = record.Status === RecordStatus.Pending;
  res.render('leaderboard/submitSuccess', viewModel);
});

async function renderSubmitTimeView(res, category, errorMessage)
{
  const categoryModel = await categoryService.getCategoryModel(category.Id);

  const viewModel = {};
  viewModel.Title = 'Submit Time';
  viewModel.Category = categoryModel;
  viewModel.ErrorMessage = errorMessage;

  res.render('leaderboard/submitTime', viewModel);
}

// Moderator delete record
// ----------------------------------------------------------------------------

router.post('/:categoryUrlName/moderatorDeleteRecord', authentication.authorize, async function(req, res)
{
  const idParam = req.body.id;

  const userContext = await accountService.getUserContext(req);
  const isModerator = userContext.user.IsModerator != ModeratorType.NotModerator;

  if (!isModerator)
  {
    logger.error(`Non-moderator attempted to delete record: [${idParam}]`);
    return res.send('unauthorized access');
  }

  logger.info(`Moderator deleting record: [${idParam}]`);

  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0)
  {
    return res.send(`invalid id: ${idParam}`);
  }

  const record = await leaderboardService.getRecord(id);
  if (!record)
  {
    return res.sendStatus(404);
  }

  // Get category to make sure it's enabled and belongs to the current extension
  const category = await categoryService.getCategory(record.CategoryId);
  if (!category || category.ExtensionId !== res.locals.Extension.Id)
  {
    return res.sendStatus(403);
  }

  if (!await leaderboardService.deleteRecord(userContext, record, req.body.comment?.trim()))
  {
    logger.error(`Failed to delete record: [${id}], [${record.Player}], [${category.UrlName}]`);
    return res.send('error deleting record');
  }

  const returnUrl = `/leaderboard/${req.params.categoryUrlName}`;
  res.redirect(returnUrl);
});

module.exports = router;
