const config = require('../config/config');
const leaderboardRepository = require('../data/leaderboard-repository');

const extensionService = {};
const reservedNames = [ 'www', 'preview', 'api', 'admin', 'mail' ];

let initialized = false;
let cacheVersion = 0;
let extensionsByName = new Map();

extensionService.getExtensions = async function()
{
  await initialize();
  return [ ...extensionsByName.values() ];
};

extensionService.getExtension = async function(name)
{
  if (!name)
    return null;

  await initialize();
  return extensionsByName.get(name.toLowerCase());
};

extensionService.getDefaultExtension = async function()
{
  return await extensionService.getExtension(config.defaultExtension);
};

extensionService.isDefaultExtension = function(extension)
{
  return extension.Name.toLowerCase() === config.defaultExtension.toLowerCase();
};

extensionService.addExtension = async function(extension)
{
  validateExtension(extension);

  const existing = await extensionService.getExtension(extension.Name);
  if (existing)
    throw new Error('An extension with this name already exists.');

  await leaderboardRepository.addExtension(extension);
  extensionService.reset();
};

extensionService.updateExtension = async function(extension)
{
  validateExtension(extension);

  const existing = await getExtensionById(extension.Id);
  if (!existing)
    throw new Error('Extension not found.');

  // Hosts that don't match an extension use the default one, found by name (config.defaultExtension)
  if (extensionService.isDefaultExtension(existing) && extension.Name !== existing.Name.toLowerCase())
    throw new Error(`${existing.Name} is the default extension board and can't be renamed.`);

  const conflict = await extensionService.getExtension(extension.Name);
  if (conflict && conflict !== existing)
    throw new Error('An extension with this name already exists.');

  await leaderboardRepository.updateExtension(extension);
  extensionService.reset();
};

extensionService.deleteExtension = async function(extensionId)
{
  if (!extensionId)
    throw new Error('Extension ID is required.');

  const existing = await getExtensionById(extensionId);
  if (!existing)
    throw new Error('Extension not found.');

  if (extensionService.isDefaultExtension(existing))
    throw new Error(`${existing.Name} is the default extension board and can't be deleted.`);

  await leaderboardRepository.deleteExtension(extensionId);
  extensionService.reset();
};

// Reload extensions from the database on next use (call after changing them)
extensionService.reset = function()
{
  cacheVersion++;
  initialized = false;
};

// Normalizes Name and Description, and throws if they're invalid
function validateExtension(extension)
{
  if (!extension)
    throw new Error('Invalid extension');

  // Host names are case-insensitive, so names are stored in lowercase
  extension.Name = extension.Name?.trim().toLowerCase();
  extension.Description = extension.Description?.trim();

  if (!extension.Name || !extension.Description)
    throw new Error('Name and Description are required.');

  // The name is the subdomain, so it must be a valid host name label
  if (extension.Name.length > 63 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(extension.Name))
    throw new Error('Name is used as the subdomain, so it can only contain letters, numbers and hyphens (not at the start or end).');

  if (reservedNames.includes(extension.Name))
    throw new Error(`${extension.Name} is a reserved name.`);
}

async function getExtensionById(id)
{
  const extensions = await extensionService.getExtensions();
  return extensions.find(e => String(e.Id) === String(id));
}

async function initialize()
{
  if (initialized)
    return;

  const loadVersion = cacheVersion;
  const extensions = await leaderboardRepository.getExtensions();

  // Map instead of a plain object, so host names like "constructor" don't match built-in object properties
  const loadedExtensionsByName = new Map();

  for (const extension of extensions)
  {
    // Convert Name to lowercase for case-insensitive lookups later
    loadedExtensionsByName.set(extension.Name.toLowerCase(), extension);
  }

  extensionsByName = loadedExtensionsByName;

  // If reset() was called while loading, the loaded data may be outdated, so load again on next use
  initialized = (loadVersion === cacheVersion);
}

module.exports = extensionService;
