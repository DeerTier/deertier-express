$(document).ready(function () {
    $(".defaultTable").DataTable(
    {
        "paging": false,
        "info": false,
        "searching": false,
        "stripeClasses": [],
        "columnDefs": [
            { "targets": "nosort", "orderable": false },
            { "targets": ["dateSubmittedColumn", "escapeGameTimeColumn"], "orderSequence": ["desc", "asc"] }
        ]
    });


    if ($('#scoreDeletionLog').length) {
        $('#scoreDeletionLog').DataTable();
    }

    $('.navSectionExpander').on('click', function (e) {
        var $expander = $(e.target);
        var $currentSpan = $expander.find('span');
        var $currentUl = $expander.next('ul');
        $('.navSectionExpander').find('span').not($currentSpan).removeClass('open');
        $('ul').not($currentUl).removeClass('open');
        $expander.find('span').toggleClass('open');
        $expander.next('ul').toggleClass('open');
    });

    $("#hideRecordsWithoutVideo").on("change", function () {
        var url = location.pathname;
        if ($(this).is(":checked")) {
            url += "?hideRecordsWithoutVideo=1";
        }
        location.href = url;
    });
});

