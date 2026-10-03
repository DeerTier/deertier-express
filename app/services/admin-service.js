const utils = require('../common/utils');
const leaderboardRepository = require('../data/leaderboard-repository');
const extensionService = require('./extension-service');
const categoryService = require('./category-service');
const leaderboardService = require('./leaderboard-service');
const moderationService = require('./moderation-service');
const recordUtil = require('../common/record-util');

const adminService = {};

adminService.getAdminPages = async function(res)
{
    let adminPages = [
        { Name: 'Dashboard', PageUrl: '/Admin' },
    ];

    // Pages visible only to administrators
    if (res.locals.IsAdministrator)
    {
        adminPages = [...adminPages,
            { Name: 'Manage Extensions', PageUrl: '/Admin/ManageExtensions' },
            { Name: 'Manage Sections', PageUrl: '/Admin/ManageSections' },
            { Name: 'Manage Categories', PageUrl: '/Admin/ManageCategories' },
            { Name: 'Manage Users', PageUrl: '/Admin/ManageUsers' }
        ];
    }

    // Pages visible to moderators as well as administrators
    if (res.locals.IsModerator || res.locals.IsAdministrator)
    {
        adminPages = [...adminPages,
            { Name: 'Moderation Queue', PageUrl: '/Admin/ModerationQueue' },
            { Name: 'Moderation Log', PageUrl: '/Admin/ModerationLog' }
        ];
    }

    return adminPages;
}

// The latest moderation actions, newest first
adminService.getModerationLog = async function(limit)
{
    const entries = await moderationService.getModerationLog(limit);
    const records = await leaderboardRepository.getRecordsByIds([ ...new Set(entries.map(e => e.RecordId).filter(Boolean)) ]);
    const recordModels = await leaderboardService.getRecordModels(records);

    return entries.map(entry => ({
        ...entry,
        DateAsString: `${recordUtil.formatDateSubmitted(entry.Date)} ${utils.formatTimeComponent(entry.Date.getHours())}:${utils.formatTimeComponent(entry.Date.getMinutes())}`,
        Record: recordModels.find(r => r.ID === entry.RecordId)
    }));
};

// Categories of deleted extension boards are moved to this extension id
const unassignedExtensionId = 0;

// Category tree for the category management page: a tab for each extension board, and the selected
// board's categories grouped as sections > top level categories > subcategories
adminService.getCategoryTree = async function(selectedExtensionId)
{
    const extensions = await extensionService.getExtensions();

    // Loaded from the database instead of the category service, which only has enabled categories
    const sections = await leaderboardRepository.getSections();
    const categories = await leaderboardRepository.getAllCategories();

    categoryService.linkCategories(categories, sections);

    const extensionIds = extensions.map(e => e.Id);
    const getBoardId = c => extensionIds.includes(c.ExtensionId) ? c.ExtensionId : unassignedExtensionId;

    const boards = extensions.map(e => ({ Id: e.Id, Name: e.Name, Description: e.Description }));

    if (categories.some(c => getBoardId(c) === unassignedExtensionId))
    {
        boards.push({ Id: unassignedExtensionId, Name: 'Unassigned', Description: 'Categories without an extension board' });
    }

    const selectedBoard = boards.find(b => String(b.Id) === String(selectedExtensionId)) ?? boards[0];

    for (const board of boards)
    {
        board.CategoryCount = categories.filter(c => getBoardId(c) === board.Id).length;
        board.Selected = (board === selectedBoard);
        board.LinkUrl = `/admin/manageCategories?extension=${board.Id}`;
    }

    // Subcategories are listed under their parent, so only top level categories are grouped into sections
    const topLevelCategories = categories
        .filter(c => !c.Parent && selectedBoard && getBoardId(c) === selectedBoard.Id)
        .toSorted((a, b) => a.DisplayOrder - b.DisplayOrder);

    // Categories without a section are listed last
    const usedSections = [ ...new Set(topLevelCategories.map(c => c.Section ?? null)) ]
        .toSorted((a, b) => (a?.Id ?? Infinity) - (b?.Id ?? Infinity));

    return {
        Boards: boards,
        SelectedBoard: selectedBoard,
        Sections: usedSections.map(section => ({
            Id: section?.Id,
            Name: section?.Name ?? 'No Section',
            Categories: topLevelCategories
                .filter(c => (c.Section ?? null) === section)
                .map(c => mapTreeCategory(c, false))
        }))
    };
};

function mapTreeCategory(category, isParentDisabled)
{
    const subcategories = category.Subcategories;

    return {
        Id: category.Id,
        Name: category.Name,
        UrlName: category.UrlName,
        ShortName: category.ShortName,
        DisplayOrder: category.DisplayOrder,
        Visible: category.Visible,
        AllowSubmission: category.AllowSubmission,
        Enabled: category.Enabled,
        // Subcategories of a disabled category aren't shown on the site either
        IsParentDisabled: isParentDisabled,
        Timing: [
            category.GameTime && 'Game Time',
            category.RealTime && 'Real Time',
            category.EscapeGameTime && 'Escape Time'
        ].filter(Boolean),
        IsGroup: subcategories.length > 0,
        Subcategories: subcategories.map((s, i) => ({
            ...mapTreeCategory(s, !category.Enabled),
            IsLast: i === subcategories.length - 1
        }))
    };
}


module.exports = adminService;