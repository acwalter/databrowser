/**
 * This javascript file handles page rendering and events.
 *
 * @author      Tobin license
 * @Bradley     MIT
 */

var map = null; // map
var selectedAddress = {}; // JSON selected record object
var markers = []; // Array of markers


/*  Document Ready  */
$(document).ready(function() {

    // Convert the old URL params to hash
    if (getUrlVars()["matid"]) {
        var matid = getUrlVars()["matid"];
        var cat = getUrlVars()["category"] || "";
        window.location.replace("./#/" + matid + "/" + cat);
    }


    // jQuery UI Accordion
    $('#accordion-data').accordion({
        header: "h3",
        collapsible: true,
        autoHeight: false,
        create: function(event, ui) {
            $(this).fadeIn("slow");
        }
    });

    // jQuery UI Dialogs
    $("#search-dialog").dialog({
        width: 400,
        autoOpen: false,
        show: 'fade',
        hide: 'fade',
        open: function(event, ui) { $("#search-dialog-video").html('<iframe width="350" height="262" src="http://www.youtube-nocookie.com/embed/aGlmVQXRRj4?rel=0" frameborder="0" allowfullscreen></iframe>'); },
        close: function(event, ui) { $("#search-dialog-video").empty(); }
    });
    $("#help-dialog").dialog({
        width: 670,
        autoOpen: false,
        show: 'fade',
        hide: 'fade',
        open: function(event, ui) { $("#help-dialog-video").html('<iframe width="640" height="480" src="http://www.youtube-nocookie.com/embed/O3S3QobjONM?rel=0" frameborder="0" allowfullscreen></iframe>'); },
        close: function(event, ui) { $("#help-dialog-video").empty(); }
    });
    $("#new-dialog").dialog({
        width: 380,
        autoOpen: false,
        show: 'fade',
        hide: 'fade'
    });
    $("#welcome-dialog").dialog({
        width: 550,
        autoOpen: false,
        show: 'fade',
        hide: 'fade'
    });
    $("#buffer-dialog").dialog({
        width: 280,
        height: 145,
        autoOpen: false,
        position: [485, 120],
        show: 'fade',
        hide: 'fade'
    });
    $("#gallery-dialog").dialog({
        width: 500,
        minHeight: 400,
        autoOpen: false,
        show: 'fade',
        hide: 'fade'
    });
    $("#problem-dialog").dialog({
        minWidth: 600,
        minHeight: 400,
        autoOpen: false,
        show: 'fade',
        hide: 'fade',
        modal: true
    });
    $("#photo-dialog").dialog({
        minWidth: 500,
        minHeight: 400,
        autoOpen: false,
        show: 'fade',
        hide: 'fade',
        modal: true
    });

    // Click events
    $(".searchoptions").click(function() {
        $('#search-dialog').dialog('open');
    });
    $(".video_tutorial").click(function() {
        $('#help-dialog').dialog('open');
    });
    $("#whatsnew").click(function() {
        $('#new-dialog').dialog('open');
    });
    $(".report_data_error").on("click", function(event) {
        url = "http://maps.co.mecklenburg.nc.us/report_data_problems/report_data_errors.php";
        if (selectedAddress) url += "?extradata=" + selectedAddress.address;
        $("#problem-dialog").html('<iframe src="' + url + '" style="width: 600px; min-height: 500px; border: none;"></iframe>');
        $("#problem-dialog").dialog("open");
    });
    $(".toggleLayer").on("click", function() {
        toggleLayer($(this).data("layer"));
    });
    $("#routeGo").on("click", function() {
        calcRoute();
    });
    $("#routeClear").on("click", function() {
        directionsDisplay.setMap(null);
        $("#directionsPanel").empty();
    });
    $("#searchinput").click(function() {
        $(this).select();
    });
    $(".selectedLocation").on("click", "a", function() {
        args = $(this).data("panzoom").split(',');
        $.publish("/map/panzoom", [{
            "lon": args[0],
            "lat": args[1],
            "zoom": args[2]
        }]);
    });

    /* Placeholder fix for crap browsers */
    if (!Modernizr.input.placeholder) {
        $('[placeholder]').focus(function() {
            var input = $(this);
            if (input.val() == input.attr('placeholder')) {
                input.val('');
                input.removeClass('placeholder');
            }
        }).blur(function() {
            var input = $(this);
            if (input.val() === '' || input.val() == input.attr('placeholder')) {
                input.addClass('placeholder');
                input.val(input.attr('placeholder'));
            }
        }).blur();
    }

    //  Map toolbar
    $("#mapcontrols").buttonset();
    $("#mapcontrols input:radio").click(function() {
        toolbar($(this));
    });
    $( "#identify" ).button({ disabled: true });
    $("#toolbar").fadeIn("slow");

    // Buttons
    $("#routeGo, #newphoto, #routeClear").button();

    // URL Hash Change Handler
    $(window).hashchange(function() {
        // hash[0] is junk(#), hash[1] is active record, hash[2] is active tab
        theHash = window.location.hash.split("/");

        if (theHash[1] && theHash[1] != selectedAddress.objectid) {
            locationFinder({ "type": "ADDRESS", "gid": theHash[1] });
        }
    });

    // Inital PubSub Subscriptions
    $.subscribe("/change/hash", changeHash); // Hash change control
    $.subscribe("/change/selected", setSelectedAddress); // Selected record change
    $.subscribe("/change/selected", setLocationText); // Selected record change
    $.subscribe("/change/selected", zoomToLonLat); // Zoom to Location
    $.subscribe("/change/selected", addMarker); // Add Marker
    $.subscribe("/layers/addmarker", zoomToLonLat); // Zoom to location
    $.subscribe("/layers/addmarker", addMarker); // Add marker
    $.subscribe("/map/panzoom", zoomToLonLat); // Zoom to location

    // jQuery UI Autocomplete
    $("#searchinput").autocomplete({
        minLength: 4,
        delay: 250,
        autoFocus: true,
        source: function(request, response) {
            $.ajax({
                url: config.web_service_base + "v4/ws_geo_ubersearch.php",
                dataType: "jsonp",
                data: {
                    searchtypes: "address,library,school,park,geoname,road,cast,intersection,pid",
                    query: request.term
                },
                success: function(data) {
                    if (data.length > 0) {
                        response($.map(data, function(item) {
                            return {
                                label: item.name,
                                gid: item.gid,
                                type: item["type"],
                                lat: item.lat,
                                lng: item.lng
                            };
                        }));
                    } else {
                        response($.map([{}], function(item) {
                            if (parseInt($("#searchinput").val(), 10)) {
                                return {
                                    // No records found message
                                    label: "More information needed for search.",
                                    responsetype: "I've got nothing"
                                };
                            } else {
                                return {
                                    // No records found message
                                    label: "No records found.",
                                    responsetype: "I've got nothing"
                                };
                            }
                        }));
                    }

                }
            });
        },
        select: function(event, ui) {
            if (ui.item.gid) {
                locationFinder(ui.item);
            }
        }
    }).data("autocomplete")._renderMenu = function(ul, items) {
        var self = this,
            currentCategory = "";
        $.each(items, function(index, item) {
            if (item["type"] != currentCategory && item["type"] !== undefined) {
                ul.append("<li class='ui-autocomplete-category'>" + item["type"] + "</li>");
                currentCategory = item["type"];
            }
            self._renderItem(ul, item);
        });
    };

});


/*
    Window Load
    For the stuff that either isn't safe for document ready or for things you don't want to slow page load.
*/
$(window).load(function() {
    // Initialize Map
    initializeMap();

    // Process the hash
    $(window).hashchange();
});


/*  Hash change handler  */

function changeHash(objectid, tabid) {
    var key = objectid || selectedAddress.objectid || "";
    window.location.hash = "/" + key;
}

/*  Set selected address  */
function setSelectedAddress(data) {
    selectedAddress = {
        "objectid": data.objectid,
        "x_coordinate": data.x_coordinate,
        "y_coordinate": data.y_coordinate,
        "parcelid": data.parcel_id,
        "groundparcel": data.ground_pid,
        "address": data.address,
        "postal_city": data.postal_city,
        "lon": data.longitude,
        "lat": data.latitude
    };
}

/*  update selected location text  */
function setLocationText(data) {
    $('.selectedLocation').html('<strong><a href="javascript:void(0)" data-panzoom="' + data.longitude + ', ' + data.latitude + ', 17" > ' + data.address + '</a></strong>');
    $("#routeFrom").val(data.address);
}

// Function to replace land classification numbers with values
function landClass(classNumber) {
    if (classNumber == 1) return "Open Space";
    if (classNumber == 2) return "Trees";
    if (classNumber == 3) return "Urban";
    if (classNumber == 4) return "Water";
    if (classNumber == 5) return "Bare";
    return "Unidentified";
}

/*
    Find locations
*/
function locationFinder(data) {
    switch (data.type) {
    case "ADDRESS":
    case "PID":
        url = config.web_service_base + 'v2/ws_mat_addressnum.php?format=json&callback=?&jsonp=?&addressnum=' + data.gid;
        $.getJSON(url, function(data) {
            if (data.total_rows > 0) {
                // Add some properties for addmarker
                data.rows[0].row.lon = data.rows[0].row.longitude;
                data.rows[0].row.lat = data.rows[0].row.latitude;
                data.rows[0].row.featuretype = 0;
                data.rows[0].row.label = "<h5>Address</h5>" + data.rows[0].row.address;
                data.rows[0].row.zoom = 17;
                $.publish("/change/selected", [data.rows[0].row]);
                $.publish("/change/hash");
            }
        });
        break;
    default:
        $.publish("/layers/addmarker", [{
            "lon": data.lng,
            "lat": data.lat,
            "featuretype": 1,
            "label": "<h5>Location</h5>" + data.label,
            "zoom": 16
        }]);
    }
}
