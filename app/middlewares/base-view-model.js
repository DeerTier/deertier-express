const config = require('../config/config');
const accountService = require('../services/account-service');
const categoryService = require('../services/category-service');
const adminService = require('../services/admin-service');

const baseViewModel = {};

baseViewModel.handleRequest = async function(req, res, next)
{
  const user = await accountService.getAuthenticatedUser(req);

  res.locals.RequestUrl = req.originalUrl;
  res.locals.IsAuthenticated = !!user;
  res.locals.Username = user?.Name;
  res.locals.IsModerator = user?.IsModerator;
  res.locals.IsAdministrator = user?.IsAdministrator;
  res.locals.CurrentYear = new Date().getFullYear();  
  res.locals.IsPreviewSite = config.isPreviewSite;

  res.locals.MainCategories =
  {
    Sections: await categoryService.getSectionModels(res.locals.Extension.Id)
  };

  // Check if we're on the admin route
  res.locals.IsAdminPage = req.originalUrl.toLowerCase().startsWith('/admin');

  if(res.locals.IsAdminPage)
  {
    res.locals.AdminPages =
    {
      // Get admin panel links from adminService
      Pages: await adminService.getAdminPages(res)
    };
  }

  next();
};

module.exports = baseViewModel;
