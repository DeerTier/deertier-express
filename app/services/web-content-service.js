const { Mutex } = require('async-mutex');
const NodeCache = require('node-cache');
const path = require('node:path');
const fs = require('fs').promises;
const config = require('../config/config');
const utils = require('../common/utils');
const logger = require('../common/logger')(__filename);

const webCache = new NodeCache();
const mutex = new Mutex();

const webContentService = {};

webContentService.getContent = async function(url)
{
  // Check cache first
  let content = webCache.get(url);
  if (content !== undefined)
  {
    return content;
  }

  const releaseLock = await mutex.acquire();
  try
  {
    // Check cache again
    content = webCache.get(url);
    if (content !== undefined)
    {
      return content;
    }

    // Reload content from source
    content = await getContentFromSource(url);
    if (!utils.isNullOrWhitespace(content))
    {
      // Cache the content
      webCache.set(url, content);

      // Save backup copy in case the source becomes unavailable
      saveContentBackup(url, content);

      return content;
    }

    // Try loading backup
    content = loadContentBackup(url);
    if (content != null)
    {
      return content;
    }
  }
  finally
  {
    releaseLock();
  }

  logger.error(`Failed to get content from cache, source, and backup for URL: ${url}`);
  return null;
};

async function getContentFromSource(url)
{
  try
  {
    const response = await fetch(url);
    const content = await response.text();
    
    if (utils.isNullOrWhitespace(content))
    {
      throw new Error('No content');
    }

    return content;
  }
  catch (ex)
  {
    logger.error(`Failed to get web content for URL: ${url}`, ex);
    return null;
  }
}

async function saveContentBackup(url, content)
{
  try
  {
    const backupFile = getBackupFilePath(url);
    await fs.mkdir(config.webContentBackupPath, { recursive: true });
    await fs.writeFile(backupFile, content, { encoding: 'utf8', flag: 'w+' });
  }
  catch (ex)
  {
    logger.error(`Failed to save content backup for URL: ${url}`, ex);
  }
}

async function loadContentBackup(url)
{
  try
  {
    const backupFile = getBackupFilePath(url);
    return await fs.readFile(backupFile, { encoding: 'utf8' });
  }
  catch (ex)
  {
    logger.error(`Filed to load content backup for URL: ${url}`, ex);
  }

  return null;
}

function getBackupFilePath(url)
{
  const fileName = sanitizeFileName(url);
  return path.join(config.webContentBackupPath, fileName);
}

const sanitizedFileNameRegex = /[A-Za-z0-9]/;

function sanitizeFileName(fileName)
{
  if (utils.isNullOrWhitespace(fileName))
  {
    return null;
  }

  let result = '';
  let lastCharWasValid = false;

  for (let i = 0; i < fileName.length; i++)
  {
    const char = fileName[i];
    if (sanitizedFileNameRegex.test(char))
    {
      result += char;
      lastCharWasValid = true;
    }
    else if (lastCharWasValid)
    {
      result += '-';
      lastCharWasValid = false;
    }
  }

  return result;
}

module.exports = webContentService;
