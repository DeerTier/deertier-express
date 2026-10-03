const { Temporal } = require('temporal-polyfill');
const utils = require('./utils');

const recordUtil = {};

recordUtil.createRecord = function(category, player, gameTime, escapeGameTime, realTime, videoLink, comment, submittedByUserId)
{
  const record =
  {
    CategoryId: category.Id,
    Player: player,
    GameTimeSeconds: 0,
    RealTimeSeconds: 0,
    CeresTime: 0,
    VideoURL: videoLink ?? '',
    Comment: comment ?? '',
    DateSubmitted: new Date(),
    SubmittedByUserId: submittedByUserId
  };

  if (category.GameTime)
  {
    const formattedTime = getFormattedGameTime(gameTime);
    if (formattedTime.TimeSeconds == -1)
    {
      return null;
    }

    record.GameTimeSeconds = formattedTime.TimeSeconds;
    record.GameTimeString = formattedTime.TimeString;
  }

  if (category.RealTime)
  {
    const formattedTime = getFormattedTime(realTime);
    if (formattedTime.TimeSeconds == -1)
    {
      return null;
    }

    record.RealTimeSeconds = formattedTime.TimeSeconds;
    record.RealTimeString = formattedTime.TimeString;
  }

  if (category.EscapeGameTime)
  {
    try
    {
      record.CeresTime = parseEscapeTime(escapeGameTime);
    }
    catch (ex)
    {
      return null;
    }
  }

  // Normalize missing/empty time strings (for legacy purposes)
  record.GameTimeString = record.GameTimeString ?? '';
  record.RealTimeString = record.RealTimeString ?? '';

  return record;
};

const threeComponentTimeRegex = /^(\d\d?):(\d\d):(\d\d?)$/;
const twoComponentTimeRegex = /^(\d\d?):(\d\d)$/;
const escapeTimeRegex = /^(\d+)['"](\d+)$/;

const invalidFormattedTime =
{
  TimeSeconds: -1,
  TimeString: '-1'
};

function getFormattedTime(timeString)
{
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  const threeComponentTime = threeComponentTimeRegex.exec(timeString);
  if (threeComponentTime)
  {
    hours = parseInt(threeComponentTime[1]);
    minutes = parseInt(threeComponentTime[2]);
    seconds = parseInt(threeComponentTime[3]);
  }
  else
  {
    const twoComponentTime = twoComponentTimeRegex.exec(timeString);
    if (twoComponentTime)
    {
      minutes = parseInt(twoComponentTime[1]);
      seconds = parseInt(twoComponentTime[2]);
    }
    else
    {
      return invalidFormattedTime;
    }
  }

  if (minutes > 59 || seconds > 59)
  {
    return invalidFormattedTime;
  }

  const formattedTime = {};
  formattedTime.TimeSeconds = (hours * 3600) + (minutes * 60) + seconds;

  if (hours > 0)
  {
    formattedTime.TimeString = `${hours}:${utils.formatTimeComponent(minutes)}:${utils.formatTimeComponent(seconds)}`;
  }
  else
  {
    formattedTime.TimeString = `${utils.formatTimeComponent(minutes)}:${utils.formatTimeComponent(seconds)}`;
  }

  return formattedTime;
}

// Parse a time string in the "HH:MM" format
// MM range: 00 to 59
// HH range: 00 to 99
function getFormattedGameTime(timeString)
{
  let hours = 0;
  let minutes = 0;

  const twoComponentTime = twoComponentTimeRegex.exec(timeString);
  if (twoComponentTime)
  {
    hours = parseInt(twoComponentTime[1]);
    minutes = parseInt(twoComponentTime[2]);
  }
  else
  {
    return invalidFormattedTime;
  }

  if (minutes > 59)
  {
    return invalidFormattedTime;
  }

  const formattedTime = {};
  formattedTime.TimeSeconds = (hours * 3600) + (minutes * 60);
  formattedTime.TimeString = `${utils.formatTimeComponent(hours)}:${utils.formatTimeComponent(minutes)}`;  

  return formattedTime;
}

function parseEscapeTime(timeString)
{
    const escapeTimeMatches = escapeTimeRegex.exec(timeString);
    if (escapeTimeMatches)
    {
      const escapeTimeAsFloatString = `${escapeTimeMatches[1]}.${escapeTimeMatches[2]}`;
      return parseFloat(escapeTimeAsFloatString);
    }
    
    throw new Error(`Invalid escape time: ${timeString}`);
}

recordUtil.getFormattedRealTime = function(realTimeSeconds)
{
  const realTime = Temporal.Duration.from({ seconds: realTimeSeconds }).round({ largestUnit: 'hours', smallestUnit: 'seconds', roundingMode: 'trunc' });
  if (realTime.hours == 0)
  {
    return `${utils.formatTimeComponent(realTime.minutes)}:${utils.formatTimeComponent(realTime.seconds)}`;
  }
  else
  {
    return `${realTime.hours}:${utils.formatTimeComponent(realTime.minutes)}:${utils.formatTimeComponent(realTime.seconds)}`;
  }
};

recordUtil.getFormattedGameTime = function(gameTimeSeconds)
{
  const gameTime = Temporal.Duration.from({ seconds: gameTimeSeconds }).round({ largestUnit: 'hours', smallestUnit: 'minutes', roundingMode: 'trunc' });
  return `${utils.formatTimeComponent(gameTime.hours)}:${utils.formatTimeComponent(gameTime.minutes)}`;
};

// escapeGameTime comes from a DECIMAL(4,2) column which mysql2 loads as a string
recordUtil.getFormattedEscapeGameTime = function(escapeGameTime)
{
  return escapeGameTime.replace('.', '\'');
};

// Orders records in a category the way the leaderboard ranks them, best first. Ties go to the earliest submission.
recordUtil.compareRecords = function(category, a, b)
{
  if (category.GameTime && category.RealTime)
  {
    return (a.GameTimeSeconds - b.GameTimeSeconds) || (a.RealTimeSeconds - b.RealTimeSeconds) || (a.DateSubmitted - b.DateSubmitted);
  }
  else if (category.GameTime)
  {
    return (a.GameTimeSeconds - b.GameTimeSeconds) || (a.DateSubmitted - b.DateSubmitted);
  }
  else if (category.EscapeGameTime)
  {
    return (b.CeresTime - a.CeresTime) || (a.DateSubmitted - b.DateSubmitted);
  }
  else
  {
    return (a.RealTimeSeconds - b.RealTimeSeconds) || (a.DateSubmitted - b.DateSubmitted);
  }
};

// Records with the same rank key share a rank on the leaderboard
recordUtil.getRankKey = function(category, record)
{
  if (category.GameTime && category.RealTime)
  {
    return `${record.GameTimeSeconds}|${record.RealTimeSeconds}`;
  }
  else if (category.GameTime)
  {
    return record.GameTimeSeconds;
  }
  else if (category.EscapeGameTime)
  {
    return record.CeresTime;
  }
  else
  {
    return record.RealTimeSeconds;
  }
};

// Comment as HTML: escaped, with the FrankerZ emote as an image
recordUtil.formatCommentAsHtml = function(comment)
{
  if (utils.isNullOrWhitespace(comment))
    return '';

  return utils.escapeHtml(comment)
    .replaceAll('FrankerZ', '<img src="/images/FrankerZ.png"/>');
};

// Video link as an icon link (Twitch, YouTube or a generic video icon)
recordUtil.formatVideoURLAsLink = function(videoURL)
{
  if (!videoURL)
    return '';

  let url = videoURL.trim();
  if (!url)
    return '';

  if (!url.startsWith('http://') &&
    !url.startsWith('https://') &&
    !url.startsWith('//'))
  {
    url = 'http://' + url;
  }

  let icon = 'fa-video-camera';

  try
  {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();
    if (host.endsWith('twitch.tv'))
    {
      icon = 'fa-twitch';
    }
    else if (host.endsWith('youtube.com') || host.endsWith('youtu.be'))
    {
      icon = 'fa-youtube-play';
    }
  }
  catch (ex) { }

  return `<a href="${utils.escapeHtml(url)}" target="_blank"><i class="fa ${icon}" aria-hidden="true"></i></a>`;
};

recordUtil.formatDateSubmitted = function(dateSubmitted)
{
  if (dateSubmitted)
  {
    const year = dateSubmitted.getFullYear();
    const month = dateSubmitted.getMonth() + 1;
    const day = dateSubmitted.getDate();
    return `${year}-${utils.formatTimeComponent(month)}-${utils.formatTimeComponent(day)}`;
  }

  return '';
};

recordUtil.getDateSubmittedSortOrder = function(dateSubmitted)
{
  return (dateSubmitted ? dateSubmitted.valueOf() : 0);
};

module.exports = recordUtil;
