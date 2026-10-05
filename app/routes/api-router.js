const express = require('express');
const utils = require('../common/utils');
const authentication = require('../middlewares/authentication');
const accountService = require('../services/account-service');
const leaderboardService = require('../services/leaderboard-service');
const categoryService = require('../services/category-service');
const recordUtil = require('../common/record-util');
const RecordStatus = require('../common/record-status');
const logger = require('../common/logger')(__filename);

const router = express.Router();

// Get all records (the public API gets only Approved records)
// ----------------------------------------------------------------------------

router.get('/records', async function(req, res, next)
{
  const records = await leaderboardService.getAllRecords();

  const formattedRecords = (await Promise.all(
      records.map(async r => await mapRecord(r, res.locals.Extension.Id))
    ))
    .filter(r => r != null);

  res.json(formattedRecords);
});

async function mapRecord(record, extensionId)
{
  const category = await categoryService.getCategory(record.CategoryId);

  if (category == null || category.ExtensionId !== extensionId)
  {
    return null;
  }

  let formattedRealTime = null;
  let formattedGameTime = null;
  let formattedEscapeGameTime = null;

  if (category.RealTime)
  {
    formattedRealTime = recordUtil.getFormattedRealTime(record.RealTimeSeconds);
  }

  if (category.GameTime)
  {
    formattedGameTime = recordUtil.getFormattedGameTime(record.GameTimeSeconds);
  }

  if (category.EscapeGameTime)
  {
    formattedEscapeGameTime = recordUtil.getFormattedEscapeGameTime(record.CeresTime);
  }

  const result = 
  {
    ID: record.ID,
    Username: record.Player,
    Category: category.UrlName,
    RealTime: formattedRealTime,
    GameTime: formattedGameTime,
    EscapeGameTime: formattedEscapeGameTime,
    VideoUrl: record.VideoURL,
    Comment: record.Comment,
    DateSubmitted: (record.DateSubmitted ? `/Date(${record.DateSubmitted.valueOf()})/` : null),
    DateSubmittedISO: record.DateSubmitted
  };

  return result;
}

// Get all categories of all boards, e.g. for showing a record's category name
// ----------------------------------------------------------------------------

router.get('/categories', async function(req, res, next)
{
  const categories = await categoryService.getCategories();
  res.json(categories.map(({ Section, Parent, Subcategories, DefaultSubcategory, ...category }) => category));
});

// Authenticated API routes
// ----------------------------------------

// Get all records for the authenticated user (including non-Approved records)
router.get('/myRecords', authentication.authorize, async function(req, res, next)
{
  const userContext = await accountService.getUserContext(req);
  res.json(await accountService.getMyRecords(userContext));
});

router.get('/recordsByStatus', authentication.authorizeModerator, async function(req, res, next)
{
  const statuses = (typeof req.query.statuses === 'string' ? req.query.statuses.split(',') : []);
  if (statuses.length === 0 || statuses[0] === '')
  {
    return res.status(400).json({ error: 'No statuses specified' });
  }

  let since = null;
  if (req.query.since !== undefined)
  {
    since = new Date(req.query.since);
    if (typeof req.query.since !== 'string' || isNaN(since))
    {
      return res.status(400).json({ error: 'Invalid since' });
    }
  }

  let after = null;
  if (req.query.after !== undefined)
  {
    after = Number(req.query.after);
    if (typeof req.query.after !== 'string' || !Number.isInteger(after) || after < 0)
    {
      return res.status(400).json({ error: 'Invalid after' });
    }
  }

  // Validate that all statuses are valid
  if (!statuses.every(status => ['Pending', 'Approved', 'Rejected', 'Deleted'].includes(status)))
  {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  res.json(await leaderboardService.getRecordsByStatus(statuses, since, after));

});


// Create a new record
router.post('/records', authentication.authorize, async function(req, res, next)
{
  const userContext = await accountService.getUserContext(req);
  const isModerator = userContext.user.IsModerator > 0 || userContext.user.IsAdministrator;

  // If the user is a moderator and has specified a player, use that; otherwise, use the authenticated user's name
  const player = isModerator && req.body.Player ? req.body.Player : userContext.user.Name;
  var isModeratorAction = player !== userContext.user.Name;
  
  const category = await categoryService.getCategory(req.body.CategoryId);
  if (category == null)
  {
    return res.status(400).json({ error: 'Invalid category' });
  }

  if ((category.GameTime && utils.isNullOrWhitespace(req.body.GameTime)) ||
      (category.RealTime && utils.isNullOrWhitespace(req.body.RealTime)) ||
      (category.EscapeGameTime && utils.isNullOrWhitespace(req.body.EscapeGameTime)))
  {
    return res.status(400).json({ error: 'Missing required time fields' });
  }

  const record = recordUtil.createRecord(
    category,
    player,
    req.body.GameTime,
    req.body.EscapeGameTime,
    req.body.RealTime,
    req.body.VideoURL,
    req.body.Comment,
    userContext.user.ID,
  )

  if(!record)
  {
    return res.status(500).json({ error: 'Failed to create record' });
  }

  if(req.body.DateSubmitted)
  {
    record.DateSubmitted = new Date(req.body.DateSubmitted);
  }

  if (req.body.Status !== undefined)
  {
    if (!userContext.user.IsModerator)
    {
      return res.status(403).json({ error: 'Only moderators can set the status explicitly' });
    }

    if (!['Pending', 'Approved', 'Rejected', 'Deleted'].includes(req.body.Status))
    {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    else
    {
      record.Status = req.body.Status;
      isModeratorAction = true;
    }
  } 
  else 
  {
    record.Status = await leaderboardService.getNewRecordStatus(category, record, isModeratorAction);  
  }

  await leaderboardService.addRecord(userContext, record, isModeratorAction);

  logger.debug(`API: Created new record for player ${player} in category ${category.UrlName}`);
  return res.status(201).json({ success: true, record: record });

});

// Update an existing record (only moderators)
// ----------------------------------------------------------------------------

// Fields that are allowed to be updated via the API
const updatableFields = [ 'CategoryId', 'Player', 'RealTime', 'GameTime', 'EscapeGameTime', 'VideoURL', 'Comment',
  'DateSubmitted', 'Status', 'Reason' ];

// Updates a record, updates only the fields provided in the request body
router.patch('/records/:id', authentication.authorizeModerator, async function(req, res, next)
{
  const id = parseRecordId(req.params.id);
  if (id == null)
  {
    return res.status(400).json({ error: 'Invalid record id' });
  }

  const body = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body))
  {
    return res.status(400).json({ error: 'Expected a JSON object body' });
  }

  // Disallow unknown fields in the request body
  const unknownFields = Object.keys(body).filter(name => !updatableFields.includes(name));
  if (unknownFields.length > 0)
  {
    return res.status(400).json({ error: `Unknown fields: ${unknownFields.join(', ')}` });
  }

  const record = await leaderboardService.getRecord(id);
  if (!record)
  {
    return res.status(404).json({ error: 'Record not found' });
  }

  const currentCategory = await categoryService.getCategory(record.CategoryId);
  if (!currentCategory)
  {
    return res.status(500).json({ error: 'Record has an unknown category' });
  }

  const changes = {};

  let category = currentCategory;
  if (body.CategoryId !== undefined)
  {
    category = await categoryService.getCategory(body.CategoryId);
    if (!category)
    {
      return res.status(400).json({ error: 'Invalid category' });
    }

    changes.CategoryId = category.Id;
  }

  if (body.Player !== undefined)
  {
    if (!isValidString(body.Player, 100) || utils.isNullOrWhitespace(body.Player))
    {
      return res.status(400).json({ error: 'Invalid Player' });
    }

    changes.Player = body.Player.trim();
  }

  if (body.RealTime !== undefined)
  {
    const realTime = (category.RealTime ? recordUtil.parseRealTime(body.RealTime) : null);
    if (!realTime || realTime.TimeSeconds == -1)
    {
      return res.status(400).json({ error: (realTime ? 'Invalid RealTime' : 'Category has no RealTime') });
    }

    changes.RealTimeSeconds = realTime.TimeSeconds;
    changes.RealTimeString = realTime.TimeString;
  }

  if (body.GameTime !== undefined)
  {
    const gameTime = (category.GameTime ? recordUtil.parseGameTime(body.GameTime) : null);
    if (!gameTime || gameTime.TimeSeconds == -1)
    {
      return res.status(400).json({ error: (gameTime ? 'Invalid GameTime' : 'Category has no GameTime') });
    }

    changes.GameTimeSeconds = gameTime.TimeSeconds;
    changes.GameTimeString = gameTime.TimeString;
  }

  if (body.EscapeGameTime !== undefined)
  {
    if (!category.EscapeGameTime)
    {
      return res.status(400).json({ error: 'Category has no EscapeGameTime' });
    }

    let escapeGameTime = NaN;
    try
    {
      escapeGameTime = recordUtil.parseEscapeTime(body.EscapeGameTime);
    }
    catch (ex)
    {
    }

    // CeresTime is DECIMAL(4,2)
    if (!(escapeGameTime < 100))
    {
      return res.status(400).json({ error: 'Invalid EscapeGameTime' });
    }

    changes.CeresTime = escapeGameTime;
  }

  // Verify that all required time fields for the category are present
  if ((category.RealTime && !((changes.RealTimeSeconds ?? record.RealTimeSeconds) > 0)) ||
      (category.GameTime && !((changes.GameTimeSeconds ?? record.GameTimeSeconds) > 0)) ||
      (category.EscapeGameTime && !(Number(changes.CeresTime ?? record.CeresTime) > 0)))
  {
    return res.status(400).json({ error: 'Missing required time fields' });
  }

  if (body.VideoURL !== undefined)
  {
    if (!isValidString(body.VideoURL, 100))
    {
      return res.status(400).json({ error: 'Invalid VideoURL' });
    }

    changes.VideoURL = body.VideoURL.trim();
  }

  if (body.Comment !== undefined)
  {
    if (!isValidString(body.Comment, 100))
    {
      return res.status(400).json({ error: 'Invalid Comment' });
    }

    changes.Comment = body.Comment.trim();
  }

  if (body.DateSubmitted !== undefined)
  {
    const dateSubmitted = new Date(body.DateSubmitted);
    if (typeof body.DateSubmitted !== 'string' || isNaN(dateSubmitted))
    {
      return res.status(400).json({ error: 'Invalid DateSubmitted' });
    }

    changes.DateSubmitted = dateSubmitted;
  }

  if (body.Status !== undefined)
  {
    if (!Object.values(RecordStatus).includes(body.Status))
    {
      return res.status(400).json({ error: `Status must be one of: ${Object.values(RecordStatus).join(', ')}` });
    }

    changes.Status = body.Status;
  }

  if (body.Reason !== undefined && !isValidString(body.Reason, 1000))
  {
    return res.status(400).json({ error: 'Invalid Reason' });
  }

  const userContext = await accountService.getUserContext(req);
  const isChanged = await leaderboardService.updateRecord(userContext, record, changes, body.Reason?.trim());

  if (isChanged)
  {
    logger.info(`API: Moderator [${userContext.user.Name}] updated record [${id}]: [${Object.keys(changes).join(', ')}]`);
  }

  return res.json({ success: true, changed: isChanged, record: await leaderboardService.getRecord(id) });
});

// Approve a record that is Pending in the moderation queue
router.post('/records/:id/approve', authentication.authorizeModerator, async function(req, res, next)
{
  await moderateRecord(req, res, leaderboardService.approveRecord);
});

// Reject a record that is Pending in the moderation queue
router.post('/records/:id/reject', authentication.authorizeModerator, async function(req, res, next)
{
  await moderateRecord(req, res, leaderboardService.rejectRecord);
});

// Like the moderation queue page: Reason is optional, and only Pending records can be approved or rejected.
// 409 when the record was already handled (e.g. by another moderator).
async function moderateRecord(req, res, moderate)
{
  const id = parseRecordId(req.params.id);
  if (id == null)
  {
    return res.status(400).json({ error: 'Invalid record id' });
  }

  // No body is fine, e.g. approving without a reason
  const reason = req.body?.Reason;
  if (reason !== undefined && !isValidString(reason, 1000))
  {
    return res.status(400).json({ error: 'Invalid Reason' });
  }

  const record = await leaderboardService.getRecord(id);
  if (!record)
  {
    return res.status(404).json({ error: 'Record not found' });
  }

  const userContext = await accountService.getUserContext(req);
  if (!await moderate(userContext, record, reason?.trim()))
  {
    return res.status(409).json({ error: 'Record is not Pending' });
  }

  return res.json({ success: true });
}

// Record id from the URL, null when it isn't a positive integer
function parseRecordId(value)
{
  const id = Number(value);
  return (Number.isInteger(id) && id > 0 ? id : null);
}

function isValidString(value, maxLength)
{
  return (typeof value === 'string' && value.trim().length <= maxLength);
}


module.exports = router;
