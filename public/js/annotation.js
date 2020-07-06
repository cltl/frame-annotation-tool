WDT_PREFIX = 'http://wikidata.org/wiki/';
type2Label = {'Q132821': 'murder', 'Q168983': 'conflagration'};

annotations = {};
referents = [];

current_task = 'None';

enforced_role_annotation = false;
predicate_selected = false;

selected_predicate_span = [];

noFrameType = 'NO-FRAME';

$(function() {
    loadFrames(function(data) {
        renderDropdownWithGroups('#fan-type-select', data, ['definition', 'framenet'], '-Pick frame-');
    });

    $('#annotation-controls').hide();
    $('#content-container').hide();

    // On click markable
    $(document).on('click', 'span.markable', function() {
        // Get all tokens with same term id
        var term_selector = $(this).attr('term-selector');
        var selector = '[term-selector="' + term_selector + '"]';
        
        var is_refering = $(selector).attr('reference');
        var is_frame = $(selector).attr('frame');
        var is_role = $(selector).attr('role');
        
        // Currently in markable correction
        if (current_task == '1') {
            $(selector).toggleClass('marked');
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
            // Add clicked term to marked items
            if (!is_frame && !is_role) {
                if (predicate_selected) {
                    $(selector).toggleClass('marked');
                }
            }
            // Select clicked term as predicate
            else if (is_frame) {
                if (!enforced_role_annotation) {
                    $(selector).toggleClass('marked');
                    predicate_selected = true;
                } else {
                    console.log($('span[frame].marked'));
                }
            }
        }

        // Currently annotating references
        else if (current_task == '4') {
            if (is_refering) {
                clearSelection();
            }

            $(selector).toggleClass('marked');
        }
    });

    $(document).on('click', 'a.structured-data', function(e) {
        if (current_task == '4') {
            if (!e.ctrlKey && !e.metaKey){
                e.preventDefault();
                $('.referent').removeClass('referent');
                $(this).addClass('referent');
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
    return $.unique($('.marked').map(function() {
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
    $('span').removeClass('marked');
    $('a').removeClass('referent');

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

var updateTask = function() {
    current_task = $('#annotation-task-selection').val();
    $('.annotated').removeClass('annotated');
    hideSelectors();
    clearSelection();

    if (current_task == '1') {
        $('.mcn-selectors').show();
    } else if (current_task == '2') {
        $('.fan-selectors').show();
        $('span[frame]').addClass('annotated');
    } else if (current_task == '3') {
        $('.fea-selectors').show();
        $('span[role]').addClass('annotated');
    } else if (current_task == '4') {
        $('span[reference]').addClass('annotated');
    } else if (current_task == '5') {
        $('.sde-selectors').show();
        $('.sde-rem-selectors').hide();
        $('.sde-add-selectors').hide();
    }

    clearChosenFrameInfo();
    clearChosenRoleInfo();
    clearRoleDropdown();
}

var updateStructeredTask = function() {
    var task = $("#sde-action-select").val();

    if (task == "1") {
        $(".sde-add-selectors").show();
        $(".sde-rem-selectors").hide();
    } else {
        $(".sde-add-selectors").hide();
        $(".sde-rem-selectors").show();
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
                });

                // Show controls
                $('#annotation-controls').show();
                $('#content-container').show();
                showAnnotations();
            }
        });
    } else{
        printMessage('Select an incident', 'error');
    }
}

// =====================================
// RENDERING ===========================
// =====================================

function renderToken(token_id, token, annotations, references, parent_term) {
    if (token == '\n') return '<br/>';

    else {
        var short_token_id = token_id.split('.')[2];
        var doc_and_sent = token_id.split('.').slice(0, 2);
        var term_selector = token_id;

        var annotated_ref = '';
        var annotated_fra = '';

        if (references[short_token_id] || references[parent_term]) {
            annotated_ref = ' reference';
        }

        // Frame annotation for current token
        if (annotations['frames'][short_token_id] || annotations['frames'][parent_term]) {
            annotated_fra = ' frame';
        }

        if (annotations['roles'][short_token_id] || annotations['roles'][parent_term]) {
            annotated_fra = ' role'
        }

        // Set term selector to parent term if it is a multiword-subtoken
        if (parent_term != 'none' && parent_term != 'undefined') {
            term_selector = doc_and_sent + '.' + parent_term;
            term_selector = term_selector.replace(',', '.');
        }

        return '<span id=' + token_id + ' class="markable" term-selector="' + term_selector + '"' + annotated_ref + annotated_fra + '>' + token + '</span> ';
    }
}

function renderTokens(tokens, docId, anns, refs) {
    var text = '';

    for (var token_num in tokens) {
        var token_info = tokens[token_num];
        var parent_term = token_info.parent_term;
        var tokenId = docId.replace(/ /g, '_') + '.' + token_info.sent + '.' + token_info.tid;
        var newToken = renderToken(tokenId, token_info.text, anns, refs, parent_term);
        var uniqueId = docId.replace(/ /g, '_') + '#' + token_info.tid;

        // unique2tool[uniqueId] = tokenId;
        text += newToken;
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
    result += '<a href="' + incident_type_url + '" data-uri="' + incident_type_uri + '" class="structured-data">' + incident_type_label + '</a>';
    result += '<br/>';

    // Render incident ID
    result += '<label>incident ID:</label> ';
    result += '<a href="' + incident_url + '" data-uri="' + incident_id + '" class="structured-data">' + incident_id + '</a>';
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

            if (i > 0) result += ', ';

            if ($.trim(cur_lab) == '')
                result += cur_url;
            else
                result += '<a href="' + cur_url + '" data-uri="' + cur_uri + '" class="structured-data" target="_blank">' + cur_lab + '</a>';
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

// =====================================
// VALIDATION UTILS ====================
// =====================================

function validateCorrection() {
    var correction_task = $('#mcn-task-select').val();
    var correction_lemma = $('#mcn-lemma-input').val();

    if (correction_task == 'None') {
        return [false, 'Please pick a correction type'];
    }

    // Get all selected markables
    var selected = getSelected();

    // Create
    if (correction_task == '1' || correction_task == '3') {
        if (!correction_lemma) {
            return [false, 'Please set lemma for markable correction'];
        }

        // Make sure at least two markables are selected
        if (!(selected.length > 1)) {
            return [false, 'Please select at least two markables'];
        }
    }

    // Remove
    else if (correction_task == '2' || correction_task == '4') {
        // Make sure at least one markable is selected
        if (parent_term == undefined) {
            return [false, 'Please select a multi word markable'];
        }
    }

    if (!sameSentence(selected)) {
        return [false, 'All terms must be in the same sentence'];
    }

    // Create
    if (correction_task == '1' || correction_task == '3') {
        var doc_id = selected[0].split('.')[0].replace(/_/g, ' ');
        var incident = $('#ic-inc-select').val();
        var task_data = { 'lemma': correction_lemma, 'tokens': selected };

        return[true, { 'incident': incident, 'doc_id': doc_id, 'task': correction_task, 'task_data': task_data }];
    }

    // Remove
    else if (correction_task == '2' || correction_task == '4') {
        var doc_id = selected[0].split('.')[0].replace(/_/g, ' ');
        var incident = $('#ic-inc-select').val();
        var task_data = { 'term_id': parent_term, 'components': selected };

        return[true, { 'incident': incident, 'doc_id': doc_id, 'task': correction_task, 'task_data': task_data }];
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
        return [false, 'Please select at least one mention'];
    }

    var doc_id = selected[0].split('.')[0].replace(/_/g, ' ');
    task_data = { 'anntype': current_task, 'doc_id': doc_id, 'frame': frame_type, 'reltype': frame_relation, 'mentions': selected };
    return [true, task_data];
}

function validateAnnotation() {
    // Frame annotation
    if (current_task == '2') {
        // Frame not chosen
        if ($('#fan-type-select').val() == 'None') {
            return [false, 'Please pick a frame'];
        }
        
        // Relation not chosen
        else if ($('#fan-relation-select').val() == 'None') {
            return [false, 'Please pick a frame relation type'];
        }
    }
    
    // Role annotation
    else if (current_task == '3') {
        if ($('#fea-role-select').val() == 'None') {
            return [false, 'Please pick a role'];
        }
    }

    // Get all selected markables
    var selected = $('.marked').map(function() {
        return $(this).attr('term-selector');
    }).get();

    var doc_id = selected[0].split('.')[0].replace(/_/g, ' ');
    var activePredicate = '';

    if (current_task == '2' && !(selected.length > 0)) {
        return [false, 'Please select at least one mention'];
    } else if (current_task == '3' ) {
        // Remove items from selected that are in the predicate span 
        selected = selected.filter(function(item) {
            return selected_predicate_span.indexOf(item) < 0;
        });
        
        // Confirm unexpressed frame element intention
        if (!(selected.length > 0)) {
            if (!confirm('Are you sure you want to annotate Frame Element as unexpressed?')) {
                return [false, 'Annotation interrupted'];
            }
        }
    }

    // Check if span of predicate has changed
    if (current_task == '2' && modifying_predicate_span) {
        if (arraysMatch(selected, selected_predicate_span)) {
            activePredicate = ($('#activePredicate').text()).split('@')[1];
        }
    }

    if (!sameSentence(selected)) {
        return [false, 'All terms of a frame must be in the same sentence'];
    }

    var wdtLinks = referents.map(x => x.split('|')[0]);
    var annotationData = {};

    if (current_task == '2') {
        var frame = $('#fan-type-select').val();
        var reltype = $('#fan-relation-select').val();

        annotationData = { 'anntype': current_task, 'doc_id': doc_id, 'frame': frame, 'reltype': reltype, 'mentions': selected, 'referents': wdtLinks, 'predicate': activePredicate};
    } else if (current_task == '3') {
        var role = $('#fea-role-select').val();

        // No marked roles 
        if (!(selected.length > 0)) {
            annotationData = {'anntype': current_task, 'doc_id': doc_id, 'prid': $('#activePredicate').text().split('@')[1], 'mentions': ['unexpressed'], 'semRole': role, 'referents': wdtLinks};
        } else {
            annotationData = {'anntype': current_task, 'doc_id': doc_id, 'prid': $('#activePredicate').text().split('@')[1], 'mentions': selected, 'semRole': role, 'referents': wdtLinks};
        }
        /*
        if ($('#activeRole').text())
            annotationData['rlid'] = $('#activeRole').text();
        */
    } else {
        annotationData = {'anntype': current_task, 'mentions': selected};
    }

    return [true, annotationData];
}

var validateReference = function() {
    // Get all selected markables
    var selected = getSelected();

    var selected_unique = [];
    $.each(selected, function(i, el){
        if($.inArray(el, selected_unique) === -1) selected_unique.push(el);
    });

    if (!(selected_unique.length > 0)) {
        return [false, 'Select at least one markable']
    }

    // Get all selected referents
    var referent = $('.referent').data('uri');
    var type = $('.referent').data('type');

    if (referent == undefined) {
        return [false, 'Select a referent'];
    }

    var doc_id = selected_unique[0].split('.')[0].replace(/_/g, ' ');
    var incident = $('#ic-inc-select').val();
    var task_data = { 'terms': selected_unique, 'referent': referent, 'type': type };

    return[true, { 'incident': incident, 'doc_id': doc_id, 'task': 1, 'task_data': task_data }];
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
        return [true, { 'incident': incident, 'task': 5, 'task_data': task_data } ]
    } else {
        var item = $("#sde-remove-select").val().split(';');
        var rel = item[0];
        var val = item[1];

        if (item == 'None') {
            return [false, 'Select an item to remove'];
        }

        var task_data = { 'action': 2, 'relation': rel, 'item': val };
        return [true, { 'incident': incident, 'task': 5, 'task_data': task_data } ]
    }
}

function validateAndSave() {
    // No task selected
    if (current_task == 'None'){
        printMessage('Please pick an annotation type', 'error');
    }

    // Markable correction selected
    else if (current_task == '1') {
        var validation = validateCorrection();

        if (validation[0]) {
            storeCorrectionsAndReload(validation[1]);
        } else {
            printMessage(validation[1], 'error')
        }
    }

    // Frame annotation selected
    else if (current_task == '2') {
        var validation = validateFrameAnnotation();

        if (validation[0]) {
            storeAnnotationsAndReload(validation[1]);
        } else {
            printMessage(validation[1], 'error');
        }
    }

    // Frame element annotation selected
    else if (current_task == '3') {
        var validation = validateAnnotation();

        if (validation[0]) {
            storeAnnotationsAndReload(validation[1]);
        } else {
            printMessage(validation[1], 'error');
        }
    }

    // Reference annotation selected
    else if (current_task == '4') {
        var validation = validateReference();

        if (validation[0]) {
            storeReferenceAndReload(validation[1]);
        } else {
            printMessage(validation[1], 'error');
        }
    }
    
    // Structured data editing selected
    else if (current_task == '5') {
        var validation = validateStructuredData();

        if (validation[0]) {
            storeStructuredData(validation[1]);
        } else {
            printMessage(validation[1], 'error');
        }
    }
}


// =====================================
// STORE UTILS =========================
// =====================================

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

var retrieveSpansWithClass = function(cls){
    var allMentions = $(cls).map(function() {
        return $(this).attr('id');
    }).get();
    return allMentions;
}

var makeHtml = function(ref){
    var splitted = ref.split('|');
    var valLink=splitted[0];
    var valText=splitted[1];
    if ($.trim(valText)=='') 
        myHtml=valLink;
    else 
        myHtml = '<a href="' + valLink + '" target="_blank">' + valText + '</a>';
    return myHtml;
}

var showAnnotations = function(){
    $('#trails').html('');
    var html = '';

    for (var document_id in annotations){
        html += '<b>' + document_id + '</b><br/>';

        for (var token in annotations[document_id]['frames']) {
            var annotation = annotations[document_id]['frames'][token];

            var display_document_id = document_id.replace(/ /g, '_');
            var display_annotation_id = display_document_id + '#' + token;

            var $elem = selectSpanUniqueID(display_document_id, token); 
            var aText = $elem.text();

            var row = aText + ',' + token + ',' + (annotation['premon'] || noFrameType) + ',' + annotation['predicate'];
            html += '<span id="' + display_annotation_id + '" class="clickme" onclick=activatePredicateRightPanel(this.id)>' + row + '</span><br/>';
        }
    }

    $('#trails').html(html);

}

var getMaxPredicateID = function(docAnnotations){
    maxId=0;
    console.log(docAnnotations);
    for (var key in docAnnotations){
        var tidAnnotation=docAnnotations[key];
        var prid=tidAnnotation['predicate'];
        var pridNum=parseInt(prid.substring(2));
        if (pridNum>maxId) maxId=pridNum;
    }
    console.log(maxId);
    return maxId;
}

var reloadInside = function() {
    if($('span.marked').length > 0){
        var marked = $('span.marked').map(function() {
            return $(this).attr('id');
        }).get();

        var data_event = '';
        if (current_task == '2') {
            var firstDocId = marked[0].split('.')[0].replace(/_/g, ' ');
            var maxPredicateId = getMaxPredicateID(annotations[firstDocId]);

            for (var i = 0; i < marked.length; i++){
                var active = marked[i];
                var elems = active.split('.');
                var docId = elems[0].replace(/_/g, ' ');
                var tid = elems[2];

                annotations[docId]['frames'][tid] = { 'premon': $('#fan-type-select').val(), 'predicate': 'pr' + (maxPredicateId + 1).toString() };
            }

            showAnnotations();

            data_event = $('#fan-type-select').val();
            $('span.marked').attr('data-event', data_event);

            $('span.marked').removeClass().addClass('markable').addClass('annotated');
        }

        current_task = 'None';
    }
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

var updateRoleDropdown = function(frame) {
    $.get('/get_frame_elements', { 'frame': frame }, function(data, status) {
        reloadDropdownWithGroups('#fea-role-select', data, ['definition', 'framenet'], '-Pick a frame role-');
    });
}

var clearRoleDropdown = function() {
    reloadDropdownWithGroups('#fea-role-select', {}, [], '-Pick a frame role-');
}

var checkCoreRolesAnnotation = function(document_id, predicate_id, callback) {
    $.get('/get_roles', { 'docid': document_id, 'prid': predicate_id }, function(data, status) {
        console.log(data);

        for (var premon in data) {
            if (data[premon]['fe_type'] == 'Core' && !data[premon]['annotated']) {
                callback(false);
                return;
            }
        }

        callback(true);
        return;
    });
}

var allValuesSame = function(sent) {
    for(var i = 1; i < sent.length; i++)
    {
        if(sent[i] !== sent[0])
            return false;
    }
    return true;
}

var sameSentence = function(allMentions){
    var sents = allMentions.map(function(x) {return x.substring(0,x.lastIndexOf('.')); });
    return allValuesSame(sents);
}

var storeCorrectionsAndReload = function(correction_data) {
    $.post('/store_markable_correction', correction_data).done(function(result) {
        loadIncident();
    });
}

var storeAnnotationsAndReload = function(ann) {
    $.post('/store_annotations', {'annotations': ann, 'incident': $('#ic-inc-select').val() }).done(function(myData) {
        alert( 'Annotation saved. Now re-loading.' );

        var task = current_task;
        
        reloadInside();
        restoreDefaults();
        clearSelection();

        if (task == '3') {
            checkCoreRolesAnnotation(myData['docid'], myData['prid'], function(core_annotated) {
                console.log(core_annotated);
                if (!core_annotated) {
                    enforced_role_annotation = true;
                    modifying_predicate_roles = true;

                    $('#annotation-task-selection').val('3');
                    updateTask();

                    $('#annotation-task-selection').prop('disabled', true);
                    activatePredicateById(myData['docid'], myData['prid']);
                } else {
                    enforced_role_annotation = false;
                    $('#annotation-task-selection').prop('disabled', false);
                }
            });
        }
    }).fail(function(err) {
        alert('There was an error while storing your annotations');
    });

    $('#infoMessage').html('');
}

var storeReferenceAndReload = function(reference_data) {
    $.post('/store_reference', reference_data).done(function(result) {
        loadIncident();
    });
}

var storeStructuredData = function(data) {
    $.post('/store_structured_data', data).done(function(result) {
        loadIncident();
    });
}

