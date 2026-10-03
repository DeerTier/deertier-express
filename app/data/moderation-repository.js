const dbConnectionProvider = require('./db-connection-provider');

const moderationRepository = {};

moderationRepository.logModerationAction = async function(moderationAction)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.query(
      'INSERT INTO tblModerationLog SET ?',
      [ moderationAction ]);

    // Get moderation action ID
    moderationAction.Id = result.insertId;
  });
};

// Newest first, with the moderator's name
moderationRepository.getModerationLog = async function(limit)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [entries] = await connection.query(
      'SELECT m.Id, m.Action, m.Description, m.Reason, m.RelatedId1, m.Date, u.Name AS Moderator FROM tblModerationLog m '
        + 'LEFT JOIN tblUsers u ON u.ID = m.UserId '
        + 'ORDER BY m.Date DESC, m.Id DESC LIMIT ?',
      [ limit ]);

    return entries;
  });
};

module.exports = moderationRepository;
