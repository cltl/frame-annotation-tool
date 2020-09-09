const { request } = require("../../frame");

var WDT_PREFIX = 'http://wikidata.org/wiki/';
var type2Label = {'Q132821': 'murder', 'Q168983': 'conflagration'};

annotations = {};
referents = [];

var current_task = 'None';
var mcn_task = 'None';
var mcn_type = 'None';

var enforced_role_annotation = false;
var predicate_selected = false;

noFrameType = 'NO-FRAME';

$(function() {
    loadFrames(function(data) {
        renderDropdownWithGroups('#fan-type-select', data,
            ['definition', 'framenet'], '-Pick frame-');
    });

    $('#annotation-controls').hide();
    $('#content-container').hide();

    // On click markable
    $(document).on('click', 'span.markable', function() {
        // Get all tokens with same term id
        var term_selector = $(this).attr('term-selector');
        var selector = '[term-selector="' + term_selector + '"]';
        
        var is_refering = $(selector).is('[reference]');
        var is_frame = $(selector).is('[frame]');
        var is_role = $(selector).is('[role]');
        
        // Currently in markable correction
        if (current_task == '1') {
            // Add checks for already marked
            if (mcn_task == '1') {
                if (mcn_type == '3') {
                    clearSelection();
                    var token = $(selector).html();
                    $('#mcn-subdivide-input').val(token);
                    updateCPDSubdivide();
                }

                $(selector).toggleClass('marked');
            } else if (mcn_task == '2') {
                $(selector).toggleClass('marked');                
            }
        }

        // Currently annotating frames
        else if (current_task == '2') {
            if (!is_frame && !is_role) {
                $(selector).toggleClass('marked');
            } else if (is_frame) {
                clearSelection();
                activatePredicateFromText($(this));
            }
        }
        
        // Currently annotating frame elements
        else if (current_task == '3') {
            if (predicate_selected) {
                // Add clicked term to marked items
                if (!is_frame && !is_role) {
                    if (predicate_selected) {
                        $(selector).toggleClass('marked');
                    }
                } else if (is_frame) {
                    // Force annotation of core roles
                    if (!enforced_role_annotation) {
                        clearSelection();
                        $(selector).toggleClass('marked');
                        predicate_selected = true;

                        loadRoles(function(data) {
                            renderDropdownWithGroups('#fea-role-select', data,
                                ['definition', 'framenet'], '-Pick a frame role-');
                        });
                    }
                }
            } else {
                // New predicate to add roles to
                if (is_frame) {
                    $(selector).toggleClass('marked');
                    predicate_selected = true;

                    loadRoles(function(data) {
                        renderDropdownWithGroups('#fea-role-select', data,
                            ['definition', 'framenet'], '-Pick a frame role-');
                    });
                }
            }
        }

        // Currently annotating references
        else if (current_task == '4') {
            if (!is_refering) {
                $(selector).toggleClass('marked');
            }
        }
    });

    $(document).on('click', 'a.structured-data', function(e) {
        if (current_task == '4') {
            if (!e.ctrlKey && !e.metaKey){
                e.preventDefault();
                $('.structured-data.marked').removeClass('marked');
                $(this).addClass('marked');
            }
        }
    });
    
    $.get('/projects', {}, function(data, status) { 
        var projects = data['projects'];
        var types = data['types'];

        for(var i = 0; i < projects.length; i++) {
            $('#ic-pro-select').append($('<option></option>').val(projects[i]).html(projects[i]));
        }

        for(var i = 0; i < types.length; i++) {
            var typeLabel = type2Label[types[i]];
            $('#ic-typ-select').append($('<option></option>').val(types[i]).html(typeLabel));
        }
    });
});

// =====================================
// HELPERS =============================
// =====================================

function luminanace(color) {
    color = color.map(function(v) {
        v /= 255;
        
        return v <= 0.03928 ? v / 12.92 : Math.pow( (v + 0.055) / 1.055, 2.4 );
    });

    return 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
}

function contrastRatio(color1, color2) {
    return (luminanace(color1) + 0.05) / (luminanace(color2) + 0.05);
}

function hexToRGB(color) {
    color = color.replace('#', '');
    var hex = parseInt(color, 16);

    // Bitshift and mask to get r, g, b values
    var r = (hex >> 16) & 255;
    var g = (hex >> 8) & 255;
    var b = hex & 255;

    return [r, g, b];
}

function getSelected() {
    return $.unique($('.marked').not('.annotated-depends')
        .not('.structured-data').map(function() {
        return $(this).attr('term-selector');
    }).get());
}

function arraysMatch(arr1, arr2) {
    if (arr1.length != arr2.length)
        return false;

	for (var i = 0; i < arr1.length; i++)
        if (arr1[i] !== arr2[i])
            return false;

	return true;
};

// =====================================
// UI CONTROLS =========================
// =====================================

function hideSelectors() {
    $('.mcn-selectors').hide();
    $('.fan-selectors').hide();
    $('.fea-selectors').hide();
    $('.sde-selectors').hide();
}

function clearSelection() {
    predicate_selected = false;
    $('span').removeClass('marked');
    $('a').removeClass('marked');
    $('#mcn-subdivide-input').val('');
    updateCPDSubdivide();    

    if (!enforced_role_annotation) {
        $('span').removeClass('info-marked');
    }
}

function restoreDefaults() {
    $('#infoMessage').html('');
    $('.annotated').removeClass('annotated');

    // Empty docs and info panels
    $('#doc-container').html('');
    $('#ip-sdi').html('');
    clearChosenFrameInfo();
    clearChosenRoleInfo();
    clearActiveRoleTable();

    // Reset selection boxes
    $('#annotation-task-selection').val('None');
    $('#mcn-task-select').val('None');
    $('#fan-type-select').val('None');
    $('#fan-relation-select').val('None');
    $('#fea-role-select').val('None');
    $('#sde-action-select').val('None');
    $('#sde-relation-select').val('None');
    $('#sde-remove-select').val('None');

    // Reset text inputs
    $('#mcn-lemma-input').val('');
    $('#sde-uri-input').val('');
    $('#sde-label-input').val('');

    hideSelectors();
    clearSelection();

    predicate_selected = false;
}

function updateTask() {
    current_task = $('#annotation-task-selection').val();

    // Remove bold annotation
    $('.annotated').removeClass('annotated');
    $('.annotated-depends').removeClass('annotated-depends');

    hideSelectors();
    clearSelection();

    if (current_task == '1') {
        $('.mcn-selectors').show();
        $('.mcn-add-selectors').hide();
        $('.mcn-add-selectors2').hide();
        $('.mcn-add-selectors3').hide();
        $('span[multiword]').addClass('annotated');
        $('span[compound]').addClass('annotated');
    } else if (current_task == '2') {
        $('.fan-selectors').show();
        $('span[frame]').addClass('annotated');
    } else if (current_task == '3') {
        $('.fea-selectors').show();
        $('span[role]').addClass('annotated');
        $('span[frame]').addClass('annotated-depends');
    } else if (current_task == '4') {
        $('span[reference]').addClass('annotated');
    } else if (current_task == '5') {
        $('.sde-selectors').show();
        $('.sde-rem-selectors').hide();
        $('.sde-add-selectors').hide();
    }

    // clearChosenFrameInfo();
    // clearChosenRoleInfo();
    // clearRoleDropdown();
}

function updateSDETask() {
    var task = $("#sde-action-select").val();

    if (task == "1") {
        $(".sde-add-selectors").show();
        $(".sde-rem-selectors").hide();
    } else {
        $(".sde-add-selectors").hide();
        $(".sde-rem-selectors").show();
    }
}

function updateMCNTask() {
    clearSelection();
    mcn_task = $("#mcn-task-select").val();

    if (mcn_task == '1') {
        $('.mcn-add-selectors').show();
    } else {
        $('.mcn-add-selectors').hide();
        $('.mcn-add-selectors2').hide();
        $('.mcn-add-selectors3').hide();
    }
}

function updateMCNType() {
    clearSelection();
    mcn_type = $("#mcn-type-select").val();

    if (mcn_type == '1' || mcn_type == '2') {
        $('.mcn-add-selectors2').show();
        $('.mcn-add-selectors3').hide();
    } else if(mcn_type == '3') {
        $('.mcn-add-selectors2').hide();
        $('.mcn-add-selectors3').show();
    }
}

function updateCPDSubdivide() {
    var subdivisions = $('#mcn-subdivide-input').val().split('|');
    $('#cpd-subdivisions').empty();
    $('#cpd-subdivisions').append('<tr><th>Token</th><th>Lemma</th><th>POS</th><th>Head</th></tr>');

    for (var i in subdivisions) {
        var token = subdivisions[i];
        if (token != '') {
            var id = 'subdiv_' + i;

            token = '<span id=' + id + '_t>' + token + '</span>';
            var lem_input = '<input id=' + id + '_l type="text" class="w-100">';
            var pos_input = '<input id=' + id + '_p type="text" class="w-100">';
            var hea_input = '<input id=' + id + '_h type="radio" name="head">';
            $('#cpd-subdivisions').append('<tr><td>' + token + '</td>' +
                                              '<td>' + lem_input + '</td>' +
                                              '<td>' + pos_input + '</td>' +
                                              '<td>' + hea_input + '</td></tr>');
        }
    }
}

// =====================================
// UI CONTROLLED =======================
// =====================================

function updateIncidentList() {
    var selected_pro = $('#ic-pro-select').val();
    var selected_typ = $('#ic-typ-select').val();

    if (selected_pro != 'None' && selected_typ != 'None') {
        var get_data = { 'project': selected_pro, 'type': selected_typ }
        $.get('/get_project_incidents', get_data, function(result, status) {
            var old_inc = result['old'].sort();
            var new_inc = result['new'].sort();
            
            reloadDropdown('#ic-inc-select', new_inc, '-Select an incident-');
        });
    } else{
        reloadDropdown('#ic-inc-select', [], '-Select an incident-');
    }
}

function loadIncident() {
    var incident_id = $('#ic-inc-select').val();

    if (incident_id != 'None') {
        annotations = {};
        restoreDefaults();
        clearSelection();

        loadNAFFiles(incident_id, function(documents) {
            // Check document not locked
            if (documents != 0) {
                for (var i in documents) {
                    renderDocument(documents[i]);
                }

                // Load and render structured data
                loadStructuredData(incident_id, function(data) {
                    renderStructuredData(incident_id, data);

                    var dropdown_data = { 'sem:hasPlace': [],
                                          'sem:hasActor': [],
                                          'sem:hasTimeStamp': [] };

                    // Populate dropdown
                    for (var key in data) {
                        for (var i in data[key]) {
                            var data_items = data[key][i].split(' | ');
                            var record = { 'value': key + ';' + data_items[0] + ' | ' + data_items[1], 'label': data_items[1] };
                            dropdown_data[key].push(record);
                        }
                    }

                    renderDropdownWithGroups('#sde-remove-select', dropdown_data, [], '-Pick item-');
                });

                // Show controls
                $('#annotation-controls').show();
                $('#content-container').show();
            }
        });
    } else{
        printMessage('Select an incident', 'error');
    }
}

// TODO: Add doc_id to store and reload
function saveChanges() {
    // No task selected
    if (current_task == 'None'){
        printMessage('Please pick an annotation type', 'error');
    }

    // Markable correction selected
    else if (current_task == '1') {
        var validation = validateCorrection();

        if (validation[0]) {
            storeAndReload(validation[1]);
        } else {
            printMessage(validation[1], 'error')
        }
    }

    // Frame annotation selected
    else if (current_task == '2') {
        var validation = validateFrameAnnotation();

        if (validation[0]) {
            storeAndReload(validation[1]);
        } else {
            printMessage(validation[1], 'error');
        }
    }

    // Frame element annotation selected
    else if (current_task == '3') {
        var validation = validateRoleAnnotation();

        if (validation[0]) {
            storeAndReload(validation[1]);
        } else {
            printMessage(validation[1], 'error');
        }
    }

    // Reference annotation selected
    else if (current_task == '4') {
        var validation = validateReference();

        if (validation[0]) {
            storeAndReload(validation[1]);
        } else {
            printMessage(validation[1], 'error');
        }
    }
    
    // Structured data editing selected
    else if (current_task == '5') {
        var validation = validateStructuredData();

        if (validation[0]) {
            storeAndReload(validation[1]);
        } else {
            printMessage(validation[1], 'error');
        }
    }
}

// =====================================
// RENDERING ===========================
// =====================================

function renderToken(term, term_id_pre) {
    if (term.text == '\n') return '<br/>';
    
    var term_selector = term_id_pre + '.' + term.tid;
    // // Set term selector to parent term if it is a multiword-subtoken
    // if (parent_term != 'none' && parent_term != 'undefined') {
    //     term_selector = doc_and_sent + '.' + parent_term;
    //     term_selector = term_selector.replace(',', '.');
    //     term_id = parent_term;
    // }

    // var annotated_ref = '';
    // var annotated_fra = '';

    // // Reference annotation for current token
    // if (references[term_id]) {
    //     var reference = references[term_id]
    //     annotated_ref = ' reference="' + reference + '"';
    // }

    // // Frame annotation for current token
    // if (annotations['frames'][term_id]) {
    //     var frame = annotations['frames'][term_id]['premon'];
    //     annotated_fra = ' frame="' + frame + '"';

    //     var pr_id = annotations['frames'][term_id]['predicate'];
    //     annotated_fra += ' predicate="' + pr_id + '"';
    // }

    // // Role annotation for current token
    // else if (annotations['roles'][term_id]) {
    //     var role = annotations['roles'][term_id][0]['premon'];
    //     annotated_fra = ' role="' + role + '"';

    //     var pr_id = annotations['roles'][term_id][0]['predicate'];
    //     annotated_fra += ' predicate="' + pr_id + '"';
    // }

    // return '<span class="markable" term-selector="' + term_selector + '" ' + annotated_ref + annotated_fra + '>' + term.text + '</span> ';
    return '<span class="markable" term-selector="' + term_selector + '" ' + term.type + '>' + term.text + '</span> ';
}

function renderTokens(terms, doc_id, annotations, references) {
    var text = '';

    for (var i in terms) {
        var term = terms[i];
        var term_id_pre = doc_id.replace(/ /g, '_') + '.' + term.sent;
        text += renderToken(term, term_id_pre);
    }

    return text;
}

function renderDocument(doc_data) {
    // Extract necessary data
    var doc_id = doc_data['name']
    var source = doc_data['source'];
    var source_type = doc_data['sourcetype'];
    var doc_annotations = doc_data['annotations'];
    var doc_references = doc_data['references'];

    // Store annotations
    annotations[doc_id] = doc_annotations;

    // Render title
    var title_tokens = doc_data['title'];
    var body_tokens = doc_data['body'];

    title_render = renderTokens(title_tokens, doc_id, doc_annotations, doc_references);
    body_render = renderTokens(body_tokens, doc_id, doc_annotations, doc_references);

    var result = '<div class="panel panel-default" id="' + doc_id + '">';
    result += '<div class="panel-heading"><h4 class="document-title">' + title_render; 
    result += '(' + source_type + ' RT; <a href="' + source + '">' + source + '</a>)';
    result += '</h4></div>';

    // Render body
    result += '<div class="panel-body">';
    result += body_render
    result += '</div></div>';

    $("#doc-container").append(result);
}

function renderStructuredData(incident_id, data) {
    var incident_type_uri = $('#ic-typ-select').val();
    var incident_type_url = WDT_PREFIX + incident_type_uri;
    var incident_type_label = type2Label[incident_type_uri] || incident_type_uri;

    var incident_url = WDT_PREFIX + incident_id;

    // Render incident type
    var result = '<label>incident type:</label> ';
    result += '<a href="' + incident_type_url + '" data-uri="' + incident_type_uri + '" target="_blank">' + incident_type_label + '</a>';
    result += '<br/>';

    // Render incident ID
    result += '<label>incident ID:</label> ';
    result += '<a href="' + incident_url + '" data-uri="' + incident_id + '" data-type="event" class="structured-data" target="_blank">' + incident_id + '</a>';
    result += '<br/>';

    // Render incident properties
    for (var property in data) {
        var prop_vals = data[property];
        var split_data = property.split(':');

        if (split_data[0] == 'pm') continue;

        var clean_property = split_data[1];
        result += '<label>' + clean_property + ':</label> ';

        // Render all values for current property
        for (var i = 0; i < prop_vals.length; i++) {
            var cur_val = prop_vals[i].split(' | ');
            var cur_url = cur_val[0];
            var cur_lab = cur_val[1];
            var cur_uri = cur_url.split('/').slice(-1)[0];
            var functionality = '';

            if (i > 0) result += ', ';

            if (clean_property != 'hasTimeStamp') {
                functionality = 'class="structured-data" data-uti="' + cur_uri + '" data-type="entity"';
            }

            if ($.trim(cur_lab) == '')
                result += '<a href="' + cur_url + '"' + functionality + '" target="_blank">' + cur_url + '</a>';
            else
                result += '<a href="' + cur_url + '"' + functionality + '" target="_blank">' + cur_lab + '</a>';
        }

        result += '<br/>';
    }

    $('#ip-sdi').html(result);
}

function renderDropdownWithGroups(element_id, items, data_items, default_option){
    var element = $(element_id);

    element.empty();
    element.append($('<option value="None" selected>' + default_option + '</option>'));

    for (var group in items) {
        var group_items = items[group];

        // Add group header
        var optgroup = $('<optgroup></optgroup>').attr('label', group);

        // Add group items
        $.each(group_items, function(item_index) {
            var item = group_items[item_index];
            var cur_option = $('<option></option>').attr('value', item['value']).text(item['label'])

            // Add potential data to each option
            for (var data_item_index in data_items) {
                var data_item = data_items[data_item_index];
                cur_option.attr('data-' + data_item, item[data_item]);
            }

            optgroup.append(cur_option);
        });

        element.append(optgroup);
    }
}

function printMessage(message, type) {
    $('#message').html(message);
    $('#message').removeClass();
    $('#message').addClass(type + '-msg');
}

// =====================================
// RETRIEVE UTILS ======================
// =====================================

function loadNAFFiles(incident_id, callback) {
    var get_data = { 'incident': incident_id };
    $.get('/load_incident', get_data, function(result, status) {
        callback(result['nafs'])
    }).fail(function(e) {
        // Incident locked
        if (e.status == 423) {
            alert('The incident you tried to load is locked by another user.');
            callback(0);
        }
    });
}

function loadStructuredData(incident_id, callback) {
    var get_data = { 'incident': incident_id };
    $.get('/get_structured_data', get_data, function(result, status) {
        callback(result);
    });
}

function loadFrames(callback) {
    $.get('/get_frames', function(result, status) {
        callback(result);
    });
}

function loadRoles(callback) {
    if (predicate_selected) {
        var get_data = { 'frame': $('span[frame].marked').attr('frame') };

        $.get('/get_frame_elements', get_data, function(result, status) {
            callback(result);
        });
    } else {
        console.warn('Roles could not be loaded: no predicate selected');
    }
}

// =====================================
// VALIDATION UTILS ====================
// =====================================
// TODO: Handle remove correction correctly
function validateCorrection() {
    var correction_task = mcn_task;
    var correction_type = mcn_type;

    var correction_lemma = $('#mcn-lemma-input').val();

    var correction_subdivisions = $('#mcn-subdivide-input').val().split('|');
    var correction_subdiv_props = [];
    var correction_subdiv_head = -1;
    var correction_subdiv_vali = true;

    if (mcn_type == '3') {
        for (var i in correction_subdivisions) {
            var id = 'subdiv_' + i;
            var cdata = $('#' + id + '_t').html();
            var lemma = $('#' + id + '_l').val();
            var pos = $('#' + id + '_p').val();
            var len = cdata.length;

            if (lemma == '' || pos == '') {
                correction_subdiv_vali = false;
            }

            correction_subdiv_props.push({ 'length': len, 'cdata': cdata, 'lemma': lemma, 'pos': pos });

            if ($('#' + id + '_h').is(':checked')) {
                correction_subdiv_head = i;
            }
        }
    }

    if (correction_task == 'None') {
        return [false, 'Select a correction task'];
    }

    if (correction_type == 'None') {
        return [false, 'Select a correction type']
    }

    // Get all selected markables
    var selected = getSelected();

    // Create
    if (correction_task == '1') {
        // Multiwords
        if (mcn_type == '1' || mcn_type == '2') {
            if (!correction_lemma) {
                return [false, 'Set lemma for markable correction'];
            }

            // Make sure at least two markables are selected
            if (!(selected.length > 1)) {
                return [false, 'Select at least two markables'];
            }
        } 

        // Compounds
        else {
            if (correction_subdivisions.length < 2) {
                return [false, 'Create at least one subdivision'];
            }

            if (!correction_subdiv_vali) {
                return [false, 'Fill in all lemma and POS inputs'];
            }

            if (correction_subdiv_head == -1) {
                return [false, 'Select a grammatical head'];                
            }

            // Make sure at least two markables are selected
            if (!(selected.length > 0)) {
                return [false, 'Select a markable'];
            }
        }
    }

    // Remove
    else {
        // Make sure at least one markable is selected
        if (parent_term == undefined) {
            return [false, 'Select a corrected markable'];
        }
    }

    // Create
    if (correction_task == '1') {
        if (correction_type == '1' || correction_type == '2') {
            // var doc_id = selected[0].split('.')[0].replace(/_/g, ' ');
            var task_data = { 'mcn_task': correction_task,
                              'mcn_type': correction_type,
                              'lemma': correction_lemma,
                              'tokens': selected };

            return[true, task_data];
        } else {
            var term_id_split = selected[0].split('');
            var term_id = 't' + term_id_split[term_id_split.length - 1];

            var task_data = { 'mcn_task': correction_task,
                              'mcn_type': correction_type,
                              'target_id': term_id,
                              'head': correction_subdiv_head,
                              'subterms': correction_subdiv_props };

            return[true, task_data];
        }
    }

    // Remove
    else {
        var task_data = { 'mcn_type': 'A', 'target_id': parent_term };

        return[true, task_data];
    }
}

function validateFrameAnnotation() {
    var frame_type = $('#fan-type-select').val();
    var frame_relation = $('#fan-relation-select').val();

    if (frame_type == 'None') {
        return [false, 'Please pick a frame type'];
    } else if (frame_relation == 'None') {
        return [false, 'Please pick a frame relation type'];
    }

    // Get all selected markables
    var selected = getSelected();

    if (!(selected.length > 0)) {
        return [false, 'Please select at least one markable'];
    }

    var task_data = { 'frame': frame_type, 'type': frame_relation, 'selected': selected };
    return [true, task_data];
}

function validateRoleAnnotation() {
    var role = $('#fea-role-select').val();

    if (role == 'None') {
        return [false, 'Please pick a role'];
    }

    var selected = getSelected();

    if (!(selected.length > 0)) {
        if (!confirm('Are you sure you want to annotate Frame Element as unexpressed?')) {
            return [false, 'Annotation interrupted'];
        }
    }

    var pr_id = $('.annotated-depends.marked').attr('predicate');
    
    var task_data = { 'pr_id': pr_id, 'role': role, 'selected': selected };
    return [true, task_data];
}

var validateReference = function() {
    // Get all selected markables
    var selected = getSelected();

    if (!(selected.length > 0)) {
        return [false, 'Select at least one markable']
    }

    // Get all selected referents
    var referent = $('.structured-data.marked')
    var referent_uri = $(referent).data('uri');
    var referent_type = $(referent).data('type');

    if (!referent.length) {
        return [false, 'Select a referent'];
    }

    var task_data = { 'selected': selected, 'reference': referent_uri, 'type': referent_type };
    return[true, task_data];
}

var validateStructuredData = function() {
    var action = $("#sde-action-select").val();

    var incident = $('#ic-inc-select').val();

    if (action == 'None') {
        return [false, 'Select data annotation action'];
    } else if (action == "1") {
        var relation = $("#sde-relation-select").val();
        var wdt_uri = $('#sde-uri-input').val();
        var label = $('#sde-label-input').val();

        if (relation == 'None') {
            return [false, 'Select a relation type'];
        }

        if (!(wdt_uri.startsWith('http://www.wikidata.org/entity'))) {
            return [false, 'Wikdidata URI must start with wikidata url']
        }

        if (label == '') {
            return [false, 'No label specified'];
        }

        var task_data = { 'action': 1, 'relation': relation, 'wdt_uri': wdt_uri, 'label': label }
        return [true, { 'task': 5, 'task_data': task_data } ]
    } else {
        var item = $("#sde-remove-select").val().split(';');
        var rel = item[0];
        var val = item[1];

        if (item == 'None') {
            return [false, 'Select an item to remove'];
        }

        var task_data = { 'action': 2, 'relation': rel, 'item': val };
        return [true, { 'task': 5, 'task_data': task_data } ]
    }
}

// =====================================
// STORE UTILS =========================
// =====================================

function storeAndReload(doc_id, task_data) {
   var request_data = { 'doc_id': doc_id, 'task': current_task, 'task_data': task_data };
   $.post('/store_annotation', request_data).done(function(result) {
        printMessage('Successfully saved annotations', 'success');
        loadIncident();
    }).fail(function(err) {
        printMessage('There was an error while saving your annotations', 'warning');
    });
}

var storeStructuredData = function(data) {
    $.post('/store_structured_data', data).done(function(result) {
        printMessage('Successfully saved annotations', 'success');
        loadIncident();
    }).fail(function(err) {
        printMessage('There was an error while saving your annotations', 'warning');
    });
}

// =====================================
// UTILS ===============================
// =====================================

var activatePredicateRightPanel = function(theId) {
    clearSelection();

    var elems = theId.split('#');
    var docId = elems[0].replace(/_/g, ' ');
    var tid = elems[1];
    activatePredicate(docId, tid);
}

var activateReferent = function(elem) {
    var ref_uri = elem.data('ref');
    $('.structured-data').removeClass('marked');
    console.log($('[data-uri="' + ref_uri + '"]'));
    $('[data-uri="' + ref_uri + '"]').addClass('marked');
}

var activatePredicateFromText = function(elem) {
    // Get document id and token id
    var element_id = elem.attr('id');
    var document_id = element_id.split('.')[0].replace(/_/g, ' ');
    var token_id = element_id.split('.')[2];

    activatePredicate(document_id, token_id);
}

var selectSpanUniqueID = function(docId, tid){
    return $('#doc-container span[id=\"' + unique2tool[docId + '#' + tid] + '\"]');
}

var activatePredicateById = function(document_id, predicate_id) {
    for (var token_id in annotations[document_id]['frames']) {
        if (annotations[document_id]['frames'][token_id]['predicate'] === predicate_id) {
            activatePredicate(document_id, token_id);
            break;
        }
    }
}

var activatePredicate = function(document_id, token_id) {
    // Get information from annotation
    var frame = annotations[document_id]['frames'][token_id]['premon'] || noFrameType;
    var predicate_id = annotations[document_id]['frames'][token_id]['predicate'];
    var display_predicate = document_id + '@' + predicate_id;

    // Set predicate summary
    $('#activeFrame').text(frame);
    $('#activePredicate').text(display_predicate);

    var document_annotations = annotations[document_id];
    var display_document_id = document_id.replace(/ /g, '_');

    // Loop over all frame annotations
    for (var annotation_id in document_annotations['frames']) {
        var annotation = document_annotations['frames'][annotation_id];

        // Highlight all spans that need to be highlighted
        if (annotation['predicate'] == predicate_id) {
            var predicate_markable = selectSpanUniqueID(display_document_id, annotation_id);
            predicate_markable.addClass('marked');

            $('span[id="' + display_document_id + '#' + annotation_id + '"]').addClass('info-marked');
        }
    }

    updateRoleDropdown(frame);

    $.get('/get_roles', { 'docid': document_id, 'prid': predicate_id }, function(data, status) {
        for (var element in data) {
            var bg_color = data[element]['color'];
            var fg_color = '#000000';

            if (contrastRatio(hexToRGB(fg_color), hexToRGB(bg_color)) < 4.5) {
                fg_color = '#FFFFFF';
            }

            var new_row = $('<tr style="color: ' + fg_color + '; background: ' + bg_color + '"></tr>');

            if (data[element]['annotated']) {
                for (var index in data[element]['target_ids']) {
                    var token = data[element]['target_ids'][index];
                    var token_span = selectSpanUniqueID(display_document_id, token);

                    token_span.attr('style', 'color: ' + fg_color + '; background: ' + bg_color);
                }
            }

            new_row.append('<td>' + data[element]['label'] + '</td>');
            new_row.append('<td>' + data[element]['fe_type'] + '</td>');
            new_row.append('<td>' + data[element]['annotated'] + '</td>');
            new_row.append('<td>' + data[element]['expressed'] + '</td>');

            $('#selectedPredicateRoleInfo').append(new_row);
        }
    });
}

var updateChosenFrameInfo = function() {
    var chosen_frame = $('#fan-type-select option:selected').text();
    var chosen_frame_premon = $('#fan-type-select option:selected').val();
    var chosen_frame_framenet = $('#fan-type-select option:selected').attr('data-framenet');
    var chosen_frame_definition = $('#fan-type-select option:selected').attr('data-definition');

    $('#chosenFrameLabel').text(chosen_frame);
    $('#chosenFrameDef').text(chosen_frame_definition);
    $('#chosenFramePrem').attr('href', chosen_frame_premon);
    $('#chosenFramePrem').text('Click here');
    $('#chosenFrameFM').attr('href', chosen_frame_framenet);
    $('#chosenFrameFM').text('Click here');
}

var clearChosenFrameInfo = function() {
    $('#chosenFrameLabel').text('');
    $('#chosenFrameDef').text('');
    $('#chosenFramePrem').attr('href', '#');
    $('#chosenFramePrem').text('');
    $('#chosenFrameFM').attr('href', '#');
    $('#chosenFrameFM').text('');
}

var updateChosenRoleInfo = function() {
    var chosen_role = $('#fea-role-select option:selected').text();
    var chosen_role_premon = $('#fea-role-select option:selected').val();
    var chosen_role_framenet = $('#fea-role-select option:selected').attr('data-framenet');
    var chosen_role_definition = $('#fea-role-select option:selected').attr('data-definition');

    $('#chosenRoleLabel').text(chosen_role);
    $('#chosenRoleDef').text(chosen_role_definition);
    $('#chosenRolePrem').attr('href', chosen_role_premon);
    $('#chosenRolePrem').text('Click here');
    $('#chosenRoleFM').attr('href', chosen_role_framenet);
    $('#chosenRoleFM').text('Click here');
}

var clearChosenRoleInfo = function() {
    $('#chosenRoleLabel').text('');
    $('#chosenRoleDef').text('');
    $('#chosenRolePrem').attr('href', '#');
    $('#chosenRolePrem').text('');
    $('#chosenRoleFM').attr('href', '#');
    $('#chosenRoleFM').text('');
}

var clearActiveRoleTable = function() {
    $('#selectedPredicateRoleInfo').find('tr:gt(0)').remove();
}

function reloadDropdown(elementId, sourceList, defaultOption) {
    var $el = $(elementId);
    $el.empty(); // remove old options
    $el.append($('<option value="None" selected>' + defaultOption + '</option>'));
    if (sourceList && sourceList.length){
        $.each(sourceList, function(anIndex) {
            var unit = sourceList[anIndex];
            $el.append($('<option></option>')
                .attr('value', unit).text(unit));
        });
    }
}
