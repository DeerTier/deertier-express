const config = require('../config/config');
const dbConnectionProvider = require('./db-connection-provider');

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
  const records = await leaderboardRepository.getRecords(categoryId, false);
  if (records.length > 0)
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

leaderboardRepository.getRecords = async function(categoryId, excludeRecordsWithoutVideo)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    let sql = 'SELECT * FROM tblRecords WHERE CategoryId = :CategoryId';
    if (excludeRecordsWithoutVideo)
    {
      sql += ' AND VideoURL <> \'\'';
    }

    const [records] = await connection.execute(
      sql,
      { CategoryId: categoryId });
    
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
    try
    {
      await connection.beginTransaction();
    
      // Delete existing record
      await connection.execute(
        'DELETE FROM tblRecords WHERE Player = :Player AND CategoryId = :CategoryId LIMIT 1',
        { Player: record.Player, CategoryId: record.CategoryId });
      
      // Insert new record
      const [result] = await connection.query(
        'INSERT INTO tblRecords SET ?',
        [ record ]);

      await connection.commit();

      // Get new record ID
      record.ID = result.insertId;
    } 
    catch (error)
    {
      await connection.rollback();
      throw error;
    }
  });
};

leaderboardRepository.deleteRecord = async function(record, ipAddress, moderator)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    try
    {
      await connection.beginTransaction();
    
      await connection.execute(
        'DELETE FROM tblRecords WHERE ID = :Id LIMIT 1',
        { Id: record.ID });
      
      await connection.query(
        'INSERT INTO tblRecordDeletionLog SET ?',
        [ { ...record, Moderator: moderator, DeletionDate: new Date(), IPAddress: ipAddress } ]);

      await connection.commit();

      return true;
    } 
    catch (error)
    {
      await connection.rollback();
      return false;
    }
  });
};  

leaderboardRepository.getAllRecords = async function()
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [records] = await connection.execute('SELECT * FROM tblRecords');
    return records;
  });
};

leaderboardRepository.getAllDeletedRecords = async function()
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [results] = await connection.execute('SELECT * FROM tblRecordDeletionLog ORDER BY ID DESC');
    return results;
  });
};

module.exports = leaderboardRepository;
