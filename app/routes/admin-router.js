const express = require('express');
const createError = require('http-errors');
const authentication = require('../middlewares/authentication');
const leaderboardRepository = require('../data/leaderboard-repository');
const leaderboardService = require('../services/leaderboard-service');
const extensionService = require('../services/extension-service');
const categoryService = require('../services/category-service');
const adminService = require('../services/admin-service');

const router = express.Router();

router.get('/', authentication.authorizeAdmin, async function(req, res, next)
{
  const viewModel = {};
  res.render('admin/index', viewModel);
});

// Extension boards
// ----------------------------------------------------------------------------
router.get('/manageExtensions', authentication.authorizeAdmin, async function(req, res, next)
{
  await renderManageExtensions(res);
});

router.get('/manageExtensions/add', authentication.authorizeAdmin, async function(req, res, next)
{
  renderEditExtension(res, 'Add Extension Board', {});
});

router.post('/manageExtensions/add', authentication.authorizeAdmin, async function(req, res, next)
{
  const extension = { Name: req.body.name, Description: req.body.description };

  if (!extension.Name || !extension.Description)
  {
    renderEditExtension(res, 'Add Extension Board', extension, 'Name and Description are required.');
    return;
  }

  // Call the extension service to validate and add the extension
  try {
    await extensionService.addExtension(extension);
    res.redirect('/admin/manageExtensions');
    return;
  } catch (error) {
    renderEditExtension(res, 'Add Extension Board', extension, error.message);
    return;
  }
});

router.get('/manageExtensions/edit/:id', authentication.authorizeAdmin, async function(req, res, next)
{
  const extension = await getExtensionById(req.params.id);
  if (!extension)
  {
    next(createError(404));
    return;
  }

  renderEditExtension(res, 'Edit Extension Board', extension);
});

router.post('/manageExtensions/edit/:id', authentication.authorizeAdmin, async function(req, res, next)
{
  const extension = { Name: req.body.name, Description: req.body.description };
  if (!extension.Name || !extension.Description)
  {
    renderEditExtension(res, 'Edit Extension Board', extension, 'Name and Description are required.');
    return;
  }

  try {
    extension.Id = req.params.id;
    await extensionService.updateExtension(extension);
    res.redirect('/admin/manageExtensions');
    return;
  } catch (error) {
    renderEditExtension(res, 'Edit Extension Board', extension, error.message);
    return;
  }
  
});

router.post('/manageExtensions/delete/:id', authentication.authorizeAdmin, async function(req, res, next)
{
  const extensionId = req.params.id;
  if (!extensionId)
  {
    await renderManageExtensions(res, 'Extension ID is required.');
    return;
  }

  try {
    await extensionService.deleteExtension(extensionId);
    res.redirect('/admin/manageExtensions');
    return;
  } catch (error) {
    await renderManageExtensions(res, error.message);
    return;
  }
});

async function renderManageExtensions(res, message)
{
  const extensions = await extensionService.getExtensions();

  const viewModel = {};
  viewModel.Title = 'Extension Boards';
  viewModel.Message = message;
  viewModel.Extensions = extensions.map(extension => ({
    ...extension,
    IsDefault: extensionService.isDefaultExtension(extension)
  }));
  res.render('admin/manageExtensions', viewModel);
}

function renderEditExtension(res, title, extension, message)
{
  const viewModel = {};
  viewModel.Title = title;
  viewModel.Message = message;
  viewModel.Extension = extension;
  res.render('admin/editExtension', viewModel);
}

async function getExtensionById(id)
{
  const extensions = await extensionService.getExtensions();
  return extensions.find(extension => String(extension.Id) === id);
}


// Category management
// ----------------------------------------------------------------------------

router.get('/manageCategories', authentication.authorizeAdmin, async function(req, res, next)
{
  // Show the current host's extension board unless another one is selected
  await renderManageCategories(res, req.query.extension ?? res.locals.Extension.Id);
});

router.post('/manageCategories/delete/:id', authentication.authorizeAdmin, async function(req, res, next)
{
  const categoryId = parseInt(req.params.id, 10);
  const category = await leaderboardRepository.getCategory(categoryId);
  if (!category)
  {
    next(createError(404));
    return;
  }

  try
  {
    await categoryService.deleteCategory(categoryId);
  }
  catch (error)
  {
    await renderManageCategories(res, category.ExtensionId, error.message);
    return;
  }

  res.redirect(`/admin/manageCategories?extension=${category.ExtensionId}`);
});

async function renderManageCategories(res, extensionId, message)
{
  const categoryTree = await adminService.getCategoryTree(extensionId);

  const viewModel = {};
  viewModel.Title = 'Categories';
  viewModel.Message = message;
  viewModel.Boards = categoryTree.Boards;
  viewModel.SelectedBoard = categoryTree.SelectedBoard;
  viewModel.Sections = categoryTree.Sections;
  res.render('admin/manageCategories', viewModel);
}

router.get('/manageCategories/add', authentication.authorizeAdmin, async function(req, res, next)
{
  // Set default values for a new category
  const category = {
    ExtensionId: parseInt(req.query.extension, 10) || 0,
    SectionId: parseInt(req.query.section, 10) || null,
    ParentId: parseInt(req.query.parent, 10) || null,
    Name: '',
    ShortName: '',
    UrlName: '',
    AllowSubmission: 1,
    Visible: 1,
    DisplayOrder: 0,
    GameTime: 0,
    EscapeGameTime: 0,
    RealTime: 1,
    WikiUrl: '',
    Note: '',
    Enabled: 1
  };

  await renderEditCategory(res, 'Add Category', category);
});

router.get('/manageCategories/edit/:id', authentication.authorizeAdmin, async function(req, res, next)
{
  // From the repository instead of the category service, so disabled categories can be edited too
  const category = await leaderboardRepository.getCategory(req.params.id);
  if (!category)
  {
    next(createError(404));
    return;
  }

  await renderEditCategory(res, 'Edit Category', category);
});

router.post('/manageCategories/add', authentication.authorizeAdmin, async function(req, res, next)
{
  const category = getCategoryFormValues(req);

  try
  {
    await categoryService.addCategory(category);
  }
  catch (err)
  {
    // Show the form again with the submitted values
    await renderEditCategory(res, 'Add Category', category, err.message);
    return;
  }

  res.redirect(`/admin/manageCategories?extension=${category.ExtensionId}`);
});

router.post('/manageCategories/edit/:id', authentication.authorizeAdmin, async function(req, res, next)
{
  const existing = await leaderboardRepository.getCategory(req.params.id);
  if (!existing)
  {
    next(createError(404));
    return;
  }

  const category = getCategoryFormValues(req);
  category.Id = parseInt(req.params.id, 10);
  category.AllowSubmission = existing.AllowSubmission;

  try
  {
    await categoryService.updateCategory(category);
  }
  catch (err)
  {
    // Show the form again with the submitted values
    await renderEditCategory(res, 'Edit Category', category, err.message);
    return;
  }

  res.redirect(`/admin/manageCategories?extension=${category.ExtensionId}`);
});

function getCategoryFormValues(req)
{
  return {
    ExtensionId: parseInt(req.body.extensionId, 10) || 0,
    Name: req.body.name?.trim(),
    ShortName: req.body.shortName?.trim() || null,
    UrlName: req.body.urlName?.trim() || null,
    ParentId: parseInt(req.body.parentId, 10) || null,
    SectionId: parseInt(req.body.sectionId, 10) || null,
    // Not on the form until submissions are gated on it, so new categories allow submissions
    // and edits keep the existing value (see the edit route)
    AllowSubmission: 1,
    Visible: req.body.visible === '1' ? 1 : 0,
    DisplayOrder: parseInt(req.body.displayOrder, 10) || 0,
    GameTime: req.body.gameTime === '1' ? 1 : 0,
    EscapeGameTime: req.body.escapeGameTime === '1' ? 1 : 0,
    RealTime: req.body.realTime === '1' ? 1 : 0,
    WikiUrl: req.body.wikiUrl?.trim() || null,
    Note: req.body.note?.trim() || null,
    Enabled: req.body.enabled === '1' ? 1 : 0
  };
}

async function renderEditCategory(res, title, category, message)
{
  // Only top level categories can be parents (categories are nested one level deep)
  const allCategories = await leaderboardRepository.getAllCategories();
  const sections = await categoryService.getAllSections();
  const extensions = await extensionService.getExtensions();

  const parentCandidates = allCategories.filter(c => !c.ParentId && c.Id !== category.Id);

  // Grouped by extension board, since a subcategory must be on the same board as its parent
  const parentGroups = [ ...extensions, { Id: 0, Name: 'Unassigned' } ]
    .map(e => ({
      Name: e.Name,
      Options: parentCandidates
        .filter(c => c.ExtensionId === e.Id)
        .map(c => ({
          Id: c.Id,
          // Names like Any% exist in several sections, so include the section to tell them apart
          Label: [ c.Name, sections.find(s => s.Id === c.SectionId)?.Name, !c.Enabled && 'disabled' ]
            .filter(Boolean)
            .join(' - ')
        }))
    }))
    .filter(g => g.Options.length > 0);

  const viewModel = {};
  viewModel.Title = title;
  viewModel.Message = message;
  viewModel.Category = category;
  viewModel.ParentGroups = parentGroups;
  viewModel.Sections = sections;
  viewModel.Extensions = extensions;
  res.render('admin/editCategory', viewModel);
}

// Section management
// ----------------------------------------------------------------------------

router.get('/manageSections', authentication.authorizeAdmin, async function(req, res, next)
{
  await renderManageSections(res);
});

router.get('/manageSections/add', authentication.authorizeAdmin, async function(req, res, next)
{
  renderEditSection(res, 'Add Section', {});
});

router.post('/manageSections/add', authentication.authorizeAdmin, async function(req, res, next)
{
  const section = { Name: req.body.name?.trim() };

  try
  {
    await categoryService.addSection(section);
  }
  catch (error)
  {
    renderEditSection(res, 'Add Section', section, error.message);
    return;
  }

  res.redirect('/admin/manageSections');
});

router.get('/manageSections/edit/:id', authentication.authorizeAdmin, async function(req, res, next)
{
  const section = await categoryService.getSection(parseInt(req.params.id, 10));
  if (!section)
  {
    next(createError(404));
    return;
  }

  renderEditSection(res, 'Edit Section', section);
});

router.post('/manageSections/edit/:id', authentication.authorizeAdmin, async function(req, res, next)
{
  const section = { Id: parseInt(req.params.id, 10), Name: req.body.name?.trim() };

  try
  {
    await categoryService.updateSection(section);
  }
  catch (error)
  {
    renderEditSection(res, 'Edit Section', section, error.message);
    return;
  }

  res.redirect('/admin/manageSections');
});

router.post('/manageSections/delete/:id', authentication.authorizeAdmin, async function(req, res, next)
{
  try
  {
    await categoryService.deleteSection(parseInt(req.params.id, 10));
  }
  catch (error)
  {
    await renderManageSections(res, error.message);
    return;
  }

  res.redirect('/admin/manageSections');
});

async function renderManageSections(res, message)
{
  // Count all categories, including disabled ones, since a section can't be deleted while any use it
  const sections = await categoryService.getAllSections();
  const allCategories = await leaderboardRepository.getAllCategories();

  const viewModel = {};
  viewModel.Title = 'Sections';
  viewModel.Message = message;
  viewModel.Sections = sections.map(section => ({
    Id: section.Id,
    Name: section.Name,
    CategoryCount: allCategories.filter(c => c.SectionId === section.Id).length
  }));
  res.render('admin/manageSections', viewModel);
}

function renderEditSection(res, title, section, message)
{
  const viewModel = {};
  viewModel.Title = title;
  viewModel.Message = message;
  viewModel.Section = section;
  res.render('admin/editSection', viewModel);
}


// Score deletion log
// ----------------------------------------------------------------------------
router.get('/scoreDeletionLog', authentication.authorizeAdmin, async function(req, res, next)
{
  const records = await leaderboardService.getAllDeletedRecords();

  const viewModel = {};
  viewModel.layout = null;    // Force no hbs layout
  viewModel.Records = records;
  res.render('admin/scoreDeletionLog', viewModel);
});

module.exports = router;
