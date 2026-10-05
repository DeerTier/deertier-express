const crypto = require('crypto');
const passwordHasher = require('aspnet-identity-pw');

const PasswordType =
{
  LegacyMd5: 0,
  AspNetIdentity: 1
};

const passwordUtil = {};

passwordUtil.PasswordType = PasswordType;

// Hash password MD5. This is the insecure, legacy hash algorithm.
function hashPasswordLegacyMd5(password)
{
  // The original .NET implementation produced hashes like: "E9-9A-18-C4-28-CB-38-D5-F2-60-85-36-78-92-2E-03"
  // Node.js produces hashes like: "e99a18c428cb38d5f260853678922e03"

  // We need to modify the Node.js hash to match the original .NET format

  const hash = crypto.createHash('md5').update(password).digest('hex').toUpperCase();

  let fixedHash = '';
  for (let i = 0; i < hash.length; i++)
  {
    if (i % 2 == 0 && i > 0)
    {
      fixedHash += '-';
    }

    fixedHash += hash[i];
  }

  return fixedHash;
}

passwordUtil.hashNewPassword = function(password)
{
  // Password type to use when creating new passwords...
  const type = PasswordType.AspNetIdentity;

  const hashedPassword = hashPassword(password, type);

  return {
    hashedPassword: hashedPassword,
    passwordType: type
  };
};

function hashPassword(password, type)
{
  if (type == PasswordType.LegacyMd5)
  {
    password = hashPasswordLegacyMd5(password);
  }

  return passwordHasher.hashPassword(password);
}

passwordUtil.verifyHashedPassword = function(hashedPassword, password, type)
{
  if (type == PasswordType.LegacyMd5)
  {
    password = hashPasswordLegacyMd5(password);
  }

  return passwordHasher.validatePassword(password, hashedPassword);
};

passwordUtil.generateRandomPassword = function()
{
  return crypto.randomBytes(16).toString('hex');
};

passwordUtil.generateApiKey = function()
{
  return crypto.randomBytes(32).toString('base64url');
};

passwordUtil.hashApiKey = function(apiKey)
{
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

module.exports = passwordUtil;
