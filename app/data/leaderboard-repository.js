const dbConnectionProvider = require('./db-connection-provider');
const RecordStatus = require('../common/record-status');

const leaderboardRepository = {};

leaderboardRepository.getExtensions = async function()
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [extensions] = await connection.execute('SELECT * FROM tblExtensions ORDER BY Id');
    return extensions;
  });
};

leaderboardRepository.getExtension = async function(id)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [extensions] = await connection.execute('SELECT * FROM tblExtensions WHERE Id = ? LIMIT 1', [id]);
    return extensions?.[0];
  });
};

leaderboardRepository.getSections = async function()
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [sections] = await connection.execute('SELECT * FROM refSections ORDER BY ID');
    return sections;
  });
};

leaderboardRepository.addSection = async function(section)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.query(
      'INSERT INTO refSections SET ?',
      [ { Name: section.Name } ]);

    // Get new section ID
    section.Id = result.insertId;
  });
};

leaderboardRepository.updateSection = async function(section)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.query(
      'UPDATE refSections SET ? WHERE Id = ?',
      [ { Name: section.Name }, section.Id ]);

    if (result.affectedRows === 0)
      throw new Error('Section not found.');
  });
};

leaderboardRepository.deleteSection = async function(sectionId)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.query(
      'DELETE FROM refSections WHERE Id = ?',
      [ sectionId ]);

    if (result.affectedRows === 0)
      throw new Error('Section not found.');
  });
};

leaderboardRepository.getCategory = async function(id)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [categories] = await connection.execute('SELECT * FROM tblCategories WHERE Id = ? LIMIT 1', [id]);
    return categories?.[0];
  });
};

leaderboardRepository.getCategories = async function()
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [categories] = await connection.execute('SELECT * FROM tblCategories WHERE Enabled = 1 ORDER BY ID');
    return categories;
  });
};

// Including disabled categories, for the admin pages
leaderboardRepository.getAllCategories = async function()
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [categories] = await connection.execute('SELECT * FROM tblCategories ORDER BY ID');
    return categories;
  });
};


leaderboardRepository.addCategory = async function(category)
{
  if (!category)
    throw new Error('Invalid category');

  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.query(
      'INSERT INTO tblCategories SET ?',
      [ category ]);

    // Get new category ID
    category.Id = result.insertId;
  });
};

leaderboardRepository.updateCategory = async function(category)
{
  if (!category || !category.Id)
    throw new Error('Invalid category');

  const existing = await leaderboardRepository.getCategory(category.Id);
  if(!existing)
    throw new Error('Category not found.');

  return await dbConnectionProvider.execute(async (connection) =>
  {
    await connection.query(
      'UPDATE tblCategories SET ? WHERE Id = ?',
      [ category, category.Id ]);

    // Subcategories are always on the same extension board as their parent
    await connection.query(
      'UPDATE tblCategories SET ExtensionId = ? WHERE ParentId = ?',
      [ category.ExtensionId, category.Id ]);
  });
};

leaderboardRepository.deleteCategory = async function(categoryId)
{
  const existing = await leaderboardRepository.getCategory(categoryId);
  if(!existing)
    throw new Error('Category not found.');

  // Only allow deletion if the category is not associated with any records
  const recordCount = await dbConnectionProvider.execute(async (connection) =>
  {
    const [results] = await connection.execute(
      'SELECT COUNT(*) AS Count FROM tblRecords WHERE CategoryId = :CategoryId',
      { CategoryId: categoryId });
    return results[0].Count;
  });
  if (recordCount > 0)
    throw new Error('Cannot delete category with associated records. Set it to disabled instead.');

  return await dbConnectionProvider.execute(async (connection) =>
  {
    await connection.query(
      'DELETE FROM tblCategories WHERE Id = ?',
      [ categoryId ]);
  });
};

leaderboardRepository.getRecord = async function(id)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [records] = await connection.execute(
      'SELECT * FROM tblRecords WHERE ID = :Id LIMIT 1',
      { Id: id }
    );

    return records?.[0];
  });
};

leaderboardRepository.getRecordsByIds = async function(ids)
{
  if (ids.length === 0)
    return [];

  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [records] = await connection.query(
      'SELECT * FROM tblRecords WHERE ID IN (?)',
      [ ids ]);

    return records;
  });
};

leaderboardRepository.getRecords = async function(categoryId, excludeRecordsWithoutVideo)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    let sql = 'SELECT * FROM tblRecords WHERE CategoryId = :CategoryId AND Status = :Status';
    if (excludeRecordsWithoutVideo)
    {
      sql += ' AND VideoURL <> \'\'';
    }

    const [records] = await connection.execute(
      sql,
      { CategoryId: categoryId, Status: RecordStatus.Approved });
    
    return records;
  });
};

leaderboardRepository.addExtension = async function(extension)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.query(
      'INSERT INTO tblExtensions SET ?',
      [ extension ]);

    // Get new extension ID
    extension.Id = result.insertId;
  });
};

leaderboardRepository.updateExtension = async function(extension)
{
  // Verify that the extension exists before updating
  const existing = await leaderboardRepository.getExtension(extension.Id);
  if(!existing)
    throw new Error('Extension not found.');

  return await dbConnectionProvider.execute(async (connection) =>
  {
    await connection.query(
      'UPDATE tblExtensions SET ? WHERE Id = ?',
      [ extension, extension.Id ]);
  });
};

leaderboardRepository.deleteExtension = async function(extensionId)
{
  // Verify that the extension exists before deleting
  const existing = await leaderboardRepository.getExtension(extensionId);
  if(!existing)
    throw new Error('Extension not found.');

  // Moves all categories associated with this extension to extension 0 (unassigned) before deletion
  await dbConnectionProvider.execute(async (connection) =>
  {
    await connection.query(
      'UPDATE tblCategories SET ExtensionId = ? WHERE ExtensionId = ?',
      [ 0, extensionId ]);
  });

  return await dbConnectionProvider.execute(async (connection) =>
  {
    await connection.query(
      'DELETE FROM tblExtensions WHERE Id = ?',
      [ extensionId ]);
  });
};

leaderboardRepository.addRecord = async function(record)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.query(
      'INSERT INTO tblRecords SET ?',
      [ record ]);

    // Get new record ID
    record.ID = result.insertId;
  });
};

leaderboardRepository.approveRecord = async function(recordId, userId, comment)
{
  return await setRecordStatus(recordId, [ RecordStatus.Pending ], RecordStatus.Approved, userId, comment);
};

leaderboardRepository.rejectRecord = async function(recordId, userId, comment)
{
  return await setRecordStatus(recordId, [ RecordStatus.Pending ], RecordStatus.Rejected, userId, comment);
};

leaderboardRepository.deleteRecord = async function(recordId, userId, comment)
{
  return await setRecordStatus(recordId, [ RecordStatus.Pending, RecordStatus.Approved, RecordStatus.Rejected ], RecordStatus.Deleted, userId, comment);
};

// Changes the status of a record, but only if it currently has one of the given statuses. Returns whether it changed.
async function setRecordStatus(recordId, fromStatuses, status, userId, comment)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.query(
      'UPDATE tblRecords SET Status = ?, StatusComment = ?, StatusChangedByUserId = ?, StatusChangedAt = ? WHERE ID = ? AND Status IN (?)',
      [ status, comment || null, userId, new Date(), recordId, fromStatuses ]);

    return result.affectedRows === 1;
  });
}

leaderboardRepository.getAllRecords = async function()
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [records] = await connection.execute(
      'SELECT * FROM tblRecords WHERE Status = :Status',
      { Status: RecordStatus.Approved });
    return records;
  });
};

leaderboardRepository.getAllRecordsByUsername = async function(username)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [records] = await connection.execute(
      'SELECT * FROM tblRecords WHERE Player = :Player',
      { Player: username });
    return records;
  });
};

leaderboardRepository.getAllPendingRecords = async function()
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [records] = await connection.execute(
      // Oldest first, so the queue is handled in submission order
      'SELECT * FROM tblRecords WHERE Status = :Status ORDER BY DateSubmitted, ID',
      { Status: RecordStatus.Pending });
    return records;
  });
};

module.exports = leaderboardRepository;
