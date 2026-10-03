const express = require('express');
const leaderboardService = require('../services/leaderboard-service');
const categoryService = require('../services/category-service');
const recordUtil = require('../common/record-util');

const router = express.Router();

// Get all records
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

module.exports = router;
