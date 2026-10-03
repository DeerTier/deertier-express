const config =
{
  // Authentication secret
  jwtSecret: process.env.JWT_SECRET,

  discordUrl: 'https://discord.gg/rT2fWZt',
  webContentBackupPath: '../WebContentBackup',
  homepageContentUrl: 'https://wiki.supermetroid.run/User:Phantomsnake/Deer_Tier_Homepage?action=render',

  // Key for admin commands
  adminKey: process.env.ADMIN_KEY,

  dbConnectionPool: 10,

  // Adjust database timezone offset to match the old .net site that was deployed at MonsterASP.net
  // This corrects most record timestamps but not all of them, unfortunately
  dbTimezone: '-06:00',

  isPreviewSite: process.env.IS_PREVIEW_SITE === "true",

  // Leaderboard extension used when the host name doesn't match one (see middlewares/extension.js)
  defaultExtension: 'deertier',

  // Domain for the auth cookie, e.g. "deertier.com" to share logins across extension subdomains.
  // Unset means the cookie only applies to the current host.
  cookieDomain: process.env.COOKIE_DOMAIN || undefined
};

module.exports = config;
