const moderationRepository = require('../data/moderation-repository');

const ModerationActionType =
{
  Unknown: 0,
  SubmitRecord: 1,      // i.e. for another user
  DeleteRecord: 2,
  ApproveRecord: 3,
  RejectRecord: 4,
  ChangeUserRoles: 5
};

const actionNames =
{
  [ModerationActionType.SubmitRecord]: 'Submitted for player',
  [ModerationActionType.DeleteRecord]: 'Deleted',
  [ModerationActionType.ApproveRecord]: 'Approved',
  [ModerationActionType.RejectRecord]: 'Rejected',
  [ModerationActionType.ChangeUserRoles]: 'Changed roles'
};

// Record actions log the record ID in RelatedId1
const recordActions = [
  ModerationActionType.SubmitRecord,
  ModerationActionType.DeleteRecord,
  ModerationActionType.ApproveRecord,
  ModerationActionType.RejectRecord
];

const moderationService = {};

// The latest moderation actions, newest first
moderationService.getModerationLog = async function(limit)
{
  const entries = await moderationRepository.getModerationLog(limit);

  return entries.map(entry => ({
    ...entry,
    ActionName: actionNames[entry.Action] ?? 'Unknown',
    RecordId: recordActions.includes(entry.Action) ? entry.RelatedId1 : null
  }));
};

moderationService.logSubmitRecord = async function(userContext, record)
{
  const action = createModerationAction(userContext, ModerationActionType.SubmitRecord);
  action.Description = `Created record [${record.ID}] for user [${record.Player}] in category [${record.CategoryId}]`;
  action.RelatedId1 = record.ID;
  await logAction(action);
};

moderationService.logDeleteRecord = async function(userContext, record, reason)
{
  const action = createModerationAction(userContext, ModerationActionType.DeleteRecord, reason);
  action.Description = `Deleted record [${record.ID}] for user [${record.Player}] in category [${record.CategoryId}]`;
  action.RelatedId1 = record.ID;
  await logAction(action);
};

moderationService.logApproveRecord = async function(userContext, record, reason)
{
  const action = createModerationAction(userContext, ModerationActionType.ApproveRecord, reason);
  action.Description = `Approved record [${record.ID}] for user [${record.Player}] in category [${record.CategoryId}]`;
  action.RelatedId1 = record.ID;
  await logAction(action);
};

moderationService.logRejectRecord = async function(userContext, record, reason)
{
  const action = createModerationAction(userContext, ModerationActionType.RejectRecord, reason);
  action.Description = `Rejected record [${record.ID}] for user [${record.Player}] in category [${record.CategoryId}]`;
  action.RelatedId1 = record.ID;
  await logAction(action);
};

moderationService.logChangeUserRoles = async function(userContext, user, roleNames)
{
  const action = createModerationAction(userContext, ModerationActionType.ChangeUserRoles);
  action.Description = `Changed roles of user [${user.Name}] to [${roleNames.join(', ') || 'none'}]`;
  action.RelatedId1 = user.ID;
  await logAction(action);
};

// Log a moderation action
function createModerationAction(userContext, action, reason)
{
  const moderationAction = 
  {
    UserId: userContext.user.ID,
    Action: action,
    Reason: reason || null,
    Date: new Date(),
    IpAddress: userContext.ipAddress,
    UserAgent: userContext.userAgent
  };

  return moderationAction;
}

async function logAction(moderationAction)
{
  await moderationRepository.logModerationAction(moderationAction);
}

module.exports = moderationService;
