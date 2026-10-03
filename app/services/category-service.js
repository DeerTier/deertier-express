const utils = require('../common/utils');
const leaderboardRepository = require('../data/leaderboard-repository');
const VerificationMode = require('../common/verification-mode');

const categoryService = {};

let initialized = false;
let cacheVersion = 0;
let sections = [];
let sectionModelsByExtensionId = {};
let categories = [];
let categoryModels = [];
let categoryModelsById = {};
let categoriesById = {};
let categoriesByUrlName = {};

categoryService.getSectionModels = async function(extensionId)
{
  await initialize();
  return sectionModelsByExtensionId[extensionId] ?? [];
};

categoryService.getAllSections = async function()
{
  await initialize();
  return sections;
};

categoryService.getSection = async function(id)
{
  await initialize();
  return sections.find(s => s.Id === id);
};

categoryService.getCategories = async function()
{
  await initialize();
  return categories;
};

categoryService.getCategory = async function(id)
{
  await initialize();
  return categoriesById[id];
};

categoryService.getCategoryModel = async function(id)
{
  await initialize();
  return categoryModelsById[id];
};

categoryService.getCategoryByUrlName = async function(urlName, extensionId)
{
  if (!urlName)
    return null;

  await initialize();
  return categoriesByUrlName[extensionId]?.[urlName.toLowerCase()];
};

categoryService.addCategory = async function(category)
{
  if (!category)
    throw new Error('Invalid category');

  normalizeCategory(category);
  await validateCategory(category);

  await leaderboardRepository.addCategory(category);
  categoryService.reset();
};

categoryService.updateCategory = async function(category)
{
  if (!category || !category.Id)
    throw new Error('Invalid category');

  normalizeCategory(category);
  await validateCategory(category);

  await leaderboardRepository.updateCategory(category);
  categoryService.reset();
};

// Subcategories are listed under their parent, so a section would also put them in the menu as top level categories
function normalizeCategory(category)
{
  if (category.ParentId)
    category.SectionId = null;
}

// Validated against all categories in the database, since disabled ones aren't cached
async function validateCategory(category)
{
  if (utils.isNullOrWhitespace(category.Name))
    throw new Error('Name is required.');

  if (!Object.values(VerificationMode).includes(category.VerificationMode))
    throw new Error('Choose a verification mode.');

  const allCategories = await leaderboardRepository.getAllCategories();
  const otherCategories = allCategories.filter(c => c.Id !== category.Id);

  if (category.ParentId)
  {
    const parent = otherCategories.find(c => c.Id === category.ParentId);

    if (!parent)
      throw new Error('Parent category not found.');

    // Categories are only nested one level deep
    if (parent.ParentId)
      throw new Error(`${parent.Name} is a subcategory itself and can't be a parent category.`);

    if (otherCategories.some(c => c.ParentId === category.Id))
      throw new Error('This category has subcategories, so it can\'t be moved under another category.');

    // Subcategories are shown as tabs on their parent's page, so they must be on the same extension board
    if (parent.ExtensionId !== category.ExtensionId)
      throw new Error(`${parent.Name} is on a different leaderboard. Pick a parent category on the same leaderboard, or None.`);
  }

  // Subcategories are moved along with their parent (see leaderboardRepository.updateCategory)
  const subcategories = otherCategories.filter(c => c.ParentId === category.Id);
  const movedCategories = [ category, ...subcategories ];

  // Leaderboard URLs are looked up by UrlName within an extension board
  for (const movedCategory of movedCategories.filter(c => c.UrlName))
  {
    const conflict = allCategories.find(c =>
      !movedCategories.some(m => m.Id === c.Id) &&
      c.ExtensionId === category.ExtensionId &&
      c.UrlName?.toLowerCase() === movedCategory.UrlName.toLowerCase());

    if (conflict)
      throw new Error(`${conflict.Name} on this leaderboard already uses the URL name ${movedCategory.UrlName}.`);
  }
}

categoryService.deleteCategory = async function(categoryId)
{
  if(!categoryId)
    throw new Error('Invalid category ID');

  // Checked against all categories in the database, since disabled ones aren't cached
  const allCategories = await leaderboardRepository.getAllCategories();
  const subcategoryCount = allCategories.filter(c => c.ParentId === categoryId).length;

  if (subcategoryCount > 0)
    throw new Error(`This category has ${subcategoryCount} ${subcategoryCount === 1 ? 'subcategory' : 'subcategories'}. Delete or move them before deleting it.`);

  await leaderboardRepository.deleteCategory(categoryId);
  categoryService.reset();
};

categoryService.addSection = async function(section)
{
  await validateSection(section);

  await leaderboardRepository.addSection(section);
  categoryService.reset();
};

categoryService.updateSection = async function(section)
{
  if (!section?.Id)
    throw new Error('Invalid section');

  await validateSection(section);

  await leaderboardRepository.updateSection(section);
  categoryService.reset();
};

categoryService.deleteSection = async function(sectionId)
{
  if (!sectionId)
    throw new Error('Invalid section ID');

  // Checked against all categories in the database, since disabled ones aren't cached
  const allCategories = await leaderboardRepository.getAllCategories();
  const categoryCount = allCategories.filter(c => c.SectionId === sectionId).length;

  if (categoryCount > 0)
    throw new Error(`This section has ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}. Move them to another section before deleting it.`);

  await leaderboardRepository.deleteSection(sectionId);
  categoryService.reset();
};

async function validateSection(section)
{
  if (utils.isNullOrWhitespace(section?.Name))
    throw new Error('Name is required.');

  // Sections are shared by all extension boards, so names must be unique to tell them apart
  const sections = await leaderboardRepository.getSections();
  const duplicate = sections.find(s =>
    s.Id !== section.Id && s.Name.toLowerCase() === section.Name.toLowerCase());

  if (duplicate)
    throw new Error(`There's already a section called ${duplicate.Name}.`);
}

// Links categories to their section, parent and subcategories
categoryService.linkCategories = function(categories, sections)
{
  for (const category of categories)
  {
    category.Section = sections.find(s => s.Id === category.SectionId);
    category.Parent = categories.find(c => c.Id === category.ParentId);
  }

  for (const category of categories)
  {
    category.Subcategories = categories
      .filter(c => c.Parent === category)
      .toSorted((a, b) => a.DisplayOrder - b.DisplayOrder);
  }
};

// Reload sections and categories from the database on next use
categoryService.reset = function()
{
  cacheVersion++;
  initialized = false;
};

async function initialize()
{
  if (initialized)
    return;

  // Load everything before replacing the cache, so no request sees it half built
  const loadVersion = cacheVersion;
  const loadedSections = await leaderboardRepository.getSections();
  const loadedCategories = await leaderboardRepository.getCategories();

  sections = loadedSections;
  categories = loadedCategories;
  sectionModelsByExtensionId = {};
  categoryModelsById = {};
  categoriesById = {};
  categoriesByUrlName = {};

  categoryService.linkCategories(categories, sections);

  // Subcategories of a disabled category aren't loaded with it, so they're disabled too
  categories = categories.filter(c => !c.ParentId || c.Parent);

  for (const category of categories)
  {
    // A group links to its first visible subcategory (hidden ones are only reachable by direct link)
    category.DefaultSubcategory = category.Subcategories.find(c => c.Visible);
  }

  for (const section of sections)
  {
    section.Categories = categories.filter(c => c.Section === section && !c.Parent).toSorted((a, b) => a.DisplayOrder - b.DisplayOrder);
  }
  
  categoryModels = categories.map(mapCategory);

  const extensionIds = [ ...new Set(categories.map(c => c.ExtensionId)) ];

  for (const extensionId of extensionIds)
  {
    const visibleSections = categories
      .filter(c => c.Section && !c.Parent && c.Visible && c.ExtensionId === extensionId)
      .map(c => c.Section);

    sectionModelsByExtensionId[extensionId] = [ ...new Set(visibleSections) ]
      .toSorted((a, b) => a.Id - b.Id)
      .map(s => mapSection(s, extensionId))
      .filter(s => s.Categories.length > 0);
  }

  for (const categoryModel of categoryModels)
  {
    categoryModelsById[categoryModel.Id] = categoryModel;
  }

  for (const category of categories)
  {
    categoriesById[category.Id] = category;

    if (category.UrlName)
    {
      // Convert UrlName to lowercase for case-insentivie lookups later
      categoriesByUrlName[category.ExtensionId] ??= {};
      categoriesByUrlName[category.ExtensionId][category.UrlName.toLowerCase()] = category;
    }
  }

  // If reset() was called while loading, the loaded data may be outdated, so load again on next use
  initialized = (loadVersion === cacheVersion);
}

function mapCategory(category)
{
  const categoryModel = { ...category };

  if (category.Parent)
  {
    categoryModel.FullName = `${category.Parent.Name} ${category.Name}`;
    categoryModel.SectionName = category.Parent.Section?.Name;

    if (utils.isNullOrWhitespace(categoryModel.WikiUrl))
    {
      categoryModel.WikiUrl = category.Parent.WikiUrl;
    }
  }
  else
  {
    categoryModel.FullName = category.Name;
    categoryModel.SectionName = category.Section?.Name;
  }

  if (!categoryModel.ShortName)
  {
    // If no short name is configured, use the regular name
    categoryModel.ShortName = category.Name;
  }

  if (!categoryModel.UrlName && category.DefaultSubcategory)
  {
    categoryModel.UrlName = category.DefaultSubcategory.UrlName;
  }

  if (categoryModel.UrlName)
  {
    categoryModel.LinkUrl = `/Leaderboard/${categoryModel.UrlName}`;
  }

  return categoryModel;
}

function mapSection(section, extensionId)
{
  const sectionModel =
  {
    Name: section.Name,
    Categories: section.Categories
      .filter(c => c.Visible && c.ExtensionId === extensionId)
      .map(c => categoryModels.find(i => i.Id === c.Id))
      // Leaves out groups without visible subcategories and categories without a URL name
      .filter(c => c.LinkUrl)
  };

  return sectionModel;
}

module.exports = categoryService;
