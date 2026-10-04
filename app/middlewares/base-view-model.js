const config = require('../config/config');
const accountService = require('../services/account-service');
const categoryService = require('../services/category-service');
const adminService = require('../services/admin-service');

const baseViewModel = {};

baseViewModel.handleRequest = async function(req, res, next)
{
  const user = await accountService.getAuthenticatedUser(req);

  let openSection = "";
  const urlSegments = req.originalUrl.split('?')[0].split('/').filter(Boolean);
  const category = await categoryService.getCategoryByUrlName(urlSegments[urlSegments.length - 1], res.locals.Extension.Id);
  if (category)
  {
    if (category.Parent)
    {
      openSection = category.Parent.Section.Name
    }
    else
    {
      openSection = category.Section.Name
    }
  }

  res.locals.RequestUrl = req.originalUrl;
  res.locals.IsAuthenticated = !!user;
  res.locals.Username = user?.Name;
  res.locals.IsModerator = user?.IsModerator;
  res.locals.IsAdministrator = user?.IsAdministrator;
  res.locals.CurrentYear = new Date().getFullYear();
  res.locals.IsPreviewSite = config.isPreviewSite;

  res.locals.MainCategories =
  {
    Sections: await categoryService.getSectionModels(res.locals.Extension.Id),
    OpenSection: openSection
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
