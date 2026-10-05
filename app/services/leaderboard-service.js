const leaderboardRepository = require('../data/leaderboard-repository');
const moderationService = require('./moderation-service');
const categoryService = require('./category-service');
const extensionService = require('./extension-service');
const recordUtil = require('../common/record-util');
const RecordStatus = require('../common/record-status');
const VerificationMode = require('../common/verification-mode');

const leaderboardService = {};

leaderboardService.getRecord = async function(id)
{
  return await leaderboardRepository.getRecord(id);
};

leaderboardService.getRecords = async function(category, excludeRecordsWithoutVideo)
{
  const records = await leaderboardRepository.getRecords(category.Id, excludeRecordsWithoutVideo);
  return getBestRecordPerPlayer(category, records);
};

leaderboardService.getNewRecordStatus = async function(category, record, isModeratorAction)
{
  // A moderator submitting a record for another player has verified it themselves
  if (isModeratorAction)
    return RecordStatus.Approved;

  switch (category.VerificationMode)
  {
    case VerificationMode.None:
      return RecordStatus.Approved;

    case VerificationMode.All:
    default:
      return RecordStatus.Pending;
  }
};

leaderboardService.addRecord = async function(userContext, record, isModeratorAction)
{
  if (isModeratorAction && record.Status === RecordStatus.Approved)
  {
    record.StatusChangedByUserId = userContext.user.ID;
    record.StatusChangedAt = record.DateSubmitted;
  }

  await leaderboardRepository.addRecord(record);

  if (isModeratorAction)
  {
    await moderationService.logSubmitRecord(userContext, record);
  }
};

leaderboardService.approveRecord = async function(userContext, record, comment)
{
  const result = await leaderboardRepository.approveRecord(record.ID, userContext.user.ID, comment);

  if (result)
  {
    await moderationService.logApproveRecord(userContext, record, comment);
  }

  return result;
};

leaderboardService.rejectRecord = async function(userContext, record, comment)
{
  const result = await leaderboardRepository.rejectRecord(record.ID, userContext.user.ID, comment);

  if (result)
  {
    await moderationService.logRejectRecord(userContext, record, comment);
  }

  return result;
};

leaderboardService.deleteRecord = async function(userContext, record, comment)
{
  const result = await leaderboardRepository.deleteRecord(record.ID, userContext.user.ID, comment);

  if (result)
  {
    await moderationService.logDeleteRecord(userContext, record, comment);
  }

  return result;
};

// Updates a record, returns whether anything changed.
leaderboardService.updateRecord = async function(userContext, record, changes, reason)
{
  // Get only the columns that have actually changed
  const columns = Object.fromEntries(
    Object.entries(changes).filter(([name, value]) => !isSameValue(record[name], value)));

  if (Object.keys(columns).length === 0)
  {
    return false;
  }

  // If status is changed, set the appropriate fields
  const isStatusChange = (columns.Status !== undefined);
  if (isStatusChange)
  {
    columns.StatusComment = reason || null;
    columns.StatusChangedByUserId = userContext.user.ID;
    columns.StatusChangedAt = new Date();
  }

  if (!await leaderboardRepository.updateRecord(record.ID, columns))
  {
    return false;
  }

  const updatedRecord = { ...record, ...columns };

  const logStatusChange = (isStatusChange ? statusChangeLogs[columns.Status] : undefined);
  if (logStatusChange)
  {
    await logStatusChange(userContext, updatedRecord, reason);
  }

  // Time strings and status details describe the change well enough on their own
  const editedFields = Object.keys(changes)
    .filter(name => name in columns && !name.endsWith('Seconds') && !(name === 'Status' && logStatusChange));

  if (editedFields.length > 0)
  {
    const descriptions = editedFields.map(name => `${name} [${formatLogValue(record[name])}] -> [${formatLogValue(columns[name])}]`);
    await moderationService.logEditRecord(userContext, updatedRecord, descriptions, reason);
  }

  return true;
};

// Setting a record to Pending (e.g. to have it checked again) has no action of its own and is logged as an edit
const statusChangeLogs =
{
  [RecordStatus.Approved]: moderationService.logApproveRecord,
  [RecordStatus.Rejected]: moderationService.logRejectRecord,
  [RecordStatus.Deleted]: moderationService.logDeleteRecord
};

// Compares a column value loaded from the database with a new value. 
function isSameValue(oldValue, newValue)
{
  if (typeof newValue === 'string')
  {
    return ((oldValue ?? '') === newValue);
  }

  if (newValue instanceof Date)
  {
    return (oldValue instanceof Date && oldValue.valueOf() === newValue.valueOf());
  }

  if (typeof newValue === 'number')
  {
    return (oldValue != null && Number(oldValue) === newValue);
  }

  return (oldValue === newValue);
}

function formatLogValue(value)
{
  return (value instanceof Date ? value.toISOString() : (value ?? ''));
}

// The leaderboard records of all categories
leaderboardService.getAllRecords = async function()
{
  const records = await leaderboardRepository.getAllRecords();

  const results = [];
  for (const [categoryId, categoryRecords] of Map.groupBy(records, r => r.CategoryId))
  {
    const category = await categoryService.getCategory(categoryId);
    if (category)
    {
      results.push(...getBestRecordPerPlayer(category, categoryRecords));
    }
  }

  return results.sort((a, b) => a.ID - b.ID);
};

leaderboardService.getRecordsByStatus = async function(statuses, since, after)
{
  return await leaderboardRepository.getRecordsByStatus(statuses, since, after);
};

leaderboardService.getLeaderboardRecordIds = async function(records)
{
  const approvedRecords = records.filter(r => r.Status === RecordStatus.Approved);
  const recordIds = new Set();

  for (const [categoryId, categoryRecords] of Map.groupBy(approvedRecords, r => r.CategoryId))
  {
    const category = await categoryService.getCategory(categoryId);
    if (category)
    {
      getBestRecordPerPlayer(category, categoryRecords).forEach(r => recordIds.add(r.ID));
    }
  }

  return recordIds;
};


// Records with resolved category, section and extension information, used for the my records and mod views
leaderboardService.getRecordModels = async function(records)
{
  const categories = await leaderboardRepository.getAllCategories();
  const sections = await categoryService.getAllSections();
  const extensions = await extensionService.getExtensions();

  return records.map(record =>
  {
    const category = categories.find(c => c.Id === record.CategoryId);
    const parent = categories.find(c => c.Id === category?.ParentId);
    // Subcategories use their parent's section, like on the leaderboard
    const section = sections.find(s => s.Id === (parent ?? category)?.SectionId);
    const extension = extensions.find(e => e.Id === category?.ExtensionId);

    return {
      ...record,
      SectionName: section?.Name,
      CategoryName: [ parent?.Name, category?.Name ?? `Unknown category ${record.CategoryId}` ].filter(Boolean).join(' '),
      BoardName: (extension && !extensionService.isDefaultExtension(extension)) ? extension.Name : null,
      FormattedGameTime: category?.EscapeGameTime && record.CeresTime
        ? recordUtil.getFormattedEscapeGameTime(record.CeresTime)
        : (category?.GameTime ? recordUtil.getFormattedGameTime(record.GameTimeSeconds) : null),
      GameTimeSortOrder: category?.EscapeGameTime ? record.CeresTime : record.GameTimeSeconds,
      FormattedRealTime: category?.RealTime ? recordUtil.getFormattedRealTime(record.RealTimeSeconds) : null,
      HtmlComment: recordUtil.formatCommentAsHtml(record.Comment),
      VideoURLAsLink: recordUtil.formatVideoURLAsLink(record.VideoURL),
      DateSubmittedAsString: recordUtil.formatDateSubmitted(record.DateSubmitted),
      DateSubmittedSortOrder: recordUtil.getDateSubmittedSortOrder(record.DateSubmitted)
    };
  });
};

// Only show the best approved record per player in a category since we now have multiple records per player
// to keep the history of previously submitted records, so we need to do some filtering here.
function getBestRecordPerPlayer(category, records)
{
  const players = new Set();

  return records
    .sort((a, b) => recordUtil.compareRecords(category, a, b))
    .filter(r =>
    {
      const player = r.Player.toLowerCase();
      if (players.has(player))
      {
        return false;
      }

      players.add(player);
      return true;
    });
}

module.exports = leaderboardService;
