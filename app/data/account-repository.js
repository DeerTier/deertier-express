const dbConnectionProvider = require('./db-connection-provider');

const accountRepository = {};

accountRepository.userExists = async function(username)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [results] = await connection.execute(
      'SELECT COUNT(*) AS Count FROM tblUsers WHERE Name = :Username',
      { Username: username }
    );

    return (results?.[0]?.Count > 0);
  });
};

accountRepository.getUser = async function(username)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [results] = await connection.execute(
      'SELECT * FROM tblUsers WHERE Name = :Username LIMIT 1',
      { Username: username }
    );

    return results?.[0];
  });
};

accountRepository.addUser = async function(user)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.query(
      'INSERT INTO tblUsers SET ?',
      [ user ]);

    // Get new user ID
    user.Id = result.insertId;
  });
};

accountRepository.changePassword = async function(username, newPassword, passwordType)
{
  try
  {
    return await dbConnectionProvider.execute(async (connection) =>
    {
      const [result] = await connection.execute(
        'UPDATE tblUsers SET Password = :Password, PasswordType = :PasswordType WHERE Name = :Username',
        { Password: newPassword, PasswordType: passwordType, Username: username });

      return true;
    });
  }
  catch (error) { }

  return false;
};

accountRepository.setAdministrator = async function(username, isAdministrator)
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [result] = await connection.execute(
      'UPDATE tblUsers SET IsAdministrator = :IsAdministrator WHERE Name = :Username',
      { IsAdministrator: isAdministrator, Username: username });

    return (result.affectedRows > 0);
  });
};

accountRepository.getModerators = async function()
{
  return await dbConnectionProvider.execute(async (connection) =>
  {
    const [results] = await connection.execute('SELECT Name FROM tblUsers WHERE IsModerator = 1');
    return results?.map(r => r.Name);
  });
};

module.exports = accountRepository;
