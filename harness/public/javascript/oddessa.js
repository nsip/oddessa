// replace jquery with vue.js data binding

var UseCases = []

$(document).ready(function() {

    var ucApi = "/oddessa/usecases"
    $.getJSON(ucApi)
        .done(function(data) {
            UseCases = data
                // console.log(UseCases);
        });

    // $.ajaxSetup({ cache: false });

    // listeners to detect 'pinning' of results between searches
    // listen to doc as these elements are added to DOM dynamically
    $(document).on("click", ".pinnable", function() {
        if ($(this).is(':checked')) {
            $(this).closest('.cd-timeline-block').removeClass('unpinned')
            $(this).closest('.cd-timeline-block').addClass('pinned')
        } else {
            // the checkbox was unchecked
            $(this).closest('.cd-timeline-block').addClass('unpinned')
            $(this).closest('.cd-timeline-block').removeClass('pinned')
        }
    });

    // handlers for sliding panel activation
    // clicking 'read more' button on a search result
    // brings in a sliding panel with the full content 
    // for that item
    // again listen to document as dom elements added after load
    $(document).on('click', ".cd-btn", function(event) {

        event.preventDefault();

        // fly in sliding panel from appropriate side
        var position = $(this).parent().css("float");
        if (position == "right") {
            $('.cd-panel').removeClass("from-right").addClass("from-left");
        } else {
            $('.cd-panel').removeClass("from-left").addClass("from-right");
        }

        // clear existing content
        $('.cd-panel-content').empty();

        // get the detailed content
        var doc = $(this).attr("docid")
            // console.log("selected doc: " + doc)

        var docApi = "/oddessa/document/" + doc
        $.getJSON(docApi)
            .done(function(data) {
                // data keys/values are as they come, not ordered or filtered 
                for (var key in data) {
                    var para = jQuery('<p></p>')
                    $(para).append('<a>' + key + '</a>')
                    $(para).append('<h6></br>' + data[key] + '</h6>')
                    $('.cd-panel-content').append(para)
                }
            });


        // turn off main page scrolling temporarily
        $("body").css("overflow", "hidden");

        // show the panel
        $('.cd-panel').addClass('is-visible');

    });


    //close the lateral panel, and remove content
    $(document).on('click', ".cd-panel", function(event) {
        // if ($(event.target).is('.cd-panel') || $(event.target).is('.cd-panel-close')) {
        if ($(event.target).is('.cd-panel')) {
            $('.cd-panel').removeClass('is-visible');
            // turn main page scrolling back on
            $("body").css("overflow", "initial");

            event.preventDefault();
        }
    });

});
// oddessa javascript functions
$(function() {

    // handler for search 'go' button
    $("#btn_search").click(function() {
        doSearch();
    });

    // invoke search and display results
    function doSearch() {
        var searchAPI = "/oddessa/search" + getSearchTypeURLsuffix();
        var searchTerms = $("#search").val();
        $.getJSON(searchAPI, {
                terms: searchTerms
            })
            .done(function(data) {
                // console.log(data);
                showResults(data);
                mergePinnables(data);
                showMap(data);
                showTables(data);
            });
    }

    // include any items previously pinned by the user in the search results
    function mergePinnables(search_results) {
        $(".pinned").each(function() {
            search_results.push($(this).data())
        })
    }

    // from the search results data generate the 
    // include/exclude tables to support the data mapping
    function showTables(data) {
        $("#tbl-excludes").empty();
        $("#tbl-includes").empty();
        $.each(data, function(index, item) {
            var includeLine = jQuery('<tr><td>' + item.Collection +
                '</td><td>' + item.CollectionFrame +
                '</td><td>' + item.DataElement +
                '</td><td>' + item.SIFObject +
                '</td><td>' + item.SIFElement + '</td></tr>')
            var excludeLine = jQuery('<tr><td>' + item.Collection +
                '</td><td>' + item.CollectionFrame +
                '</td><td>' + item.DataElement + '</td></tr>')

            if (item.SIFObject == "") {
                $("#tbl-excludes").append(excludeLine)
            } else {
                $("#tbl-includes").append(includeLine)
            }
        });
    }



    // from the search results generate the mapping to use cases 
    // generate coverage score for each search result, then
    // pass to graphing routine to display
    function showMap(data) {

        var coverage_scores = []
        var numUC = data.length
        var setSize = data.length * numUC
        var pctScore = (1 / (setSize / numUC))

        $.each(data, function(index, searchresult) {
                $.each(UseCases, function(index, usecase) {
                        // test for the use case
                        // create default score object
                        var cs = {
                            UCName: usecase.Name,
                            Score: 0.0,
                        };
                        // force search strings to uppercase & trim for comparison
                        var uppercase_objects = usecase.Objects.map(function(object) {
                            return object.toUpperCase(); });
                        if ($.inArray($.trim(searchresult.SIFObject.toUpperCase()), uppercase_objects) > -1) {
                            cs.Score = pctScore
                        }
                        coverage_scores.push(cs)

                    })
                    // test for sif data model
                var cs = {
                    UCName: "SIF-AU Data Model",
                    Score: 0.0,
                };
                if (searchresult.SIFObject != "") {
                    cs.Score = pctScore
                }
                coverage_scores.push(cs)

            })
            // console.log("scores:", coverage_scores)
            // create the coverage graph
        drawUseCaseCoverageChart(coverage_scores)
    }


    // graph rendering for use case coverage
    function drawUseCaseCoverageChart(coverage_scores) {
        // draw dimple chart
        $("#usecasesRowChart").empty()
        var svg = dimple.newSvg("#usecasesRowChart", 1000, 500);
        var myChart = new dimple.chart(svg, coverage_scores);

        myChart.setBounds("20%", 50, 590, 330)
        var x = myChart.addMeasureAxis("x", "Score");
        x.tickFormat = "%";
        x.overrideMax = 1;
        x.title = "Data Model Coverage";
        x.fontFamily = "Rubik";
        x.fontSize = "1.5rem";
        var y = myChart.addCategoryAxis("y", "UCName");
        y.title = "National Use Cases";
        y.fontFamily = "Rubik";
        y.fontSize = "1.5rem";
        myChart.addSeries(null, dimple.plot.bar);
        myChart.draw();

    }



    function clearResults() {
        // $(".cd-timeline-block").remove();
        $(".unpinned").remove();
        $("#usecasesRowChart").empty();
        $("#tbl-excludes").empty();
        $("#tbl-includes").empty();

    }

    function clearInput() {
        $("#search").val("")
    }

    // given the search results adds to the 'timeline' display
    function showResults(data) {

        $.each(data, function(i, item) {
            var newdiv = jQuery('<div class="cd-timeline-block unpinned"></div>')
            var picture = jQuery('<div class="cd-timeline-img cd-picture"></div>')
            $(picture).append('<img src="images/cd-icon-book.svg" alt="Icon">')

            var contentbox = jQuery('<div class="cd-timeline-content"></div>')
            var content = '<h3>' + item.DataElement + '</h3>' +
            '<h6>(Collection Context: ' + item.CollectionFrame + ')</h6>' +
            '<input type="checkbox" class="pinnable"> pin' +
            '<h5>Definition:</h5>' +
            '<p>' + item.Definition + '</p>' +
            '<h5>Usage:</h5>' +
            '<p>' + item.Usage + '</p>' +
            '<h5>SIF Mapping:</h5>' +
            '<p><ul>' +
            '<li>SIF Object:  ' + item.SIFObject + '</li>' +
            '<li>SIF Element: ' + item.SIFElement + '</li>' +
            '</ul></p>' +
            '<button class="cd-btn" docid="' + item.DocID + '" >Read more</button>' +
            '<span class="cd-date"><h5>' + item.Collection + '</h5></span>'
            $(contentbox).append(content)
            $(newdiv).append(picture)
            $(newdiv).append(contentbox)
                // bind data to the element for future use
            $(newdiv).data(item)

            $("#cd-timeline").append(newdiv)
        });

    }

    // when the user changes search type clear ui
    $('#searchtype input:radio').click(function() {
        clearResults();
        clearInput();
    });

    function split(val) {
        return val.split(/,\s*/);
    }

    function extractLast(term) {
        return split(term).pop();
    }

    // creates the correct search url for autocomplete based on 
    // ui selection
    function getSearchTypeURLsuffix() {
        if ($("#rdo_elements").prop("checked")) {
            return "/elements"
        }
        if ($("#rdo_sif").prop("checked")) {
            return "/sif"
        }
        if ($("#rdo_collections").prop("checked")) {
            return "/collections"
        }

    }

    // search & autocomplete handler
    $("#search")
        // don't navigate away from the field on tab when selecting an item
        .bind("keydown", function(event) {
            clearResults();
            if (event.keyCode === $.ui.keyCode.TAB &&
                $(this).autocomplete("instance").menu.active) {
                event.preventDefault();
            }
        })
        .autocomplete({
            source: function(request, response) {
                $.getJSON("/oddessa/autocomp" + getSearchTypeURLsuffix(), {
                    term: extractLast(request.term)
                }, function(data) {
                    // remove duplicates
                    // console.log(data);
                    var result = [];
                    $.each(data, function(i, e) {
                        if ($.inArray(e, result) == -1) result.push(e);
                    });
                    response(result)
                });
            },

            search: function() {
                // custom minLength
                var term = extractLast(this.value);
                if (term.length < 2) {
                    return false;
                }
            },
            focus: function() {
                // prevent value inserted on focus
                return false;
            },
            select: function(event, ui) {
                var terms = split(this.value);
                // remove the current input
                terms.pop();
                // add the selected item
                terms.push(ui.item.value);
                // add placeholder to get the comma-and-space at the end
                terms.push("");
                this.value = terms.join(", ");
                return false;
            }
        });



});



// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
//
