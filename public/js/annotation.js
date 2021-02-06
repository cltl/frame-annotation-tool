var WDT_PREFIX = 'http://wikidata.org/wiki/';

var pos_options = ''
annotations = {};

var current_task = 'None';
var fan_task = 'None';
var mcn_task = 'None';
var mcn_type = 'None';

var enforced_role_annotation = false;
var predicate_selected = false;

noFrameType = 'NO-FRAME';

const CONTRASTING_COLORS = ['#731d1d', '#ff8080', '#a6877c', '#f2853d',
                            '#402310', '#7f4400', '#e5b073', '#8c7000',
                            '#ffd940', '#eeff00', '#64664d', '#2a4000',
                            '#86b32d', '#d6f2b6', '#20f200', '#00660e',
                            '#7ca692', '#00cc88', '#00e2f2', '#00474d',
                            '#36a3d9', '#397ee6', '#26364d', '#acc3e6',
                            '#2d3eb3', '#1f00e6', '#311659', '#b836d9',
                            '#d5a3d9', '#644d66', '#80206c', '#f200a2'];

$(function() {
    $('#annotation-controls').hide();
    $('#content-container').hide();

    hideInfoPanels();

    $.get('/pos_info', function(result) {
        for (var i in result) {
            pos_options += '<option value="' + result[i] + '">' + result[i] + '</option>';
        }
    });

    // On click markable
    $(document).on('click', 'span.markable', function() {
        // Get all tokens with same term id
        var term_selector = $(this).attr('term-selector');
        var parent_selector = $(this).attr('parent-selector');

        var t_selector = '[term-selector="' + term_selector + '"]';
        var p_selector = '[parent-selector="' + parent_selector + '"]';
        
        var is_refering = $(t_selector).is('[reference]');
        var is_frame = $(t_selector).is('[frame]');
        var is_role = $(t_selector).is('[role]');
        
        // Currently in markable correction
        if (current_task == '1') {
            // Add checks for already marked
            if (mcn_task == '1') {
                if (mcn_type == '3') {
                    clearSelection();
                    var token = $(t_selector).html();
                    $('#mcn-subdivide-input').val(token);
                    updateCPDSubdivide();
                }

                $(t_selector).toggleClass('marked');
            } else if (mcn_task == '2') {
                $(p_selector).toggleClass('marked');                
            }
        }

        // Currently annotating frames
        else if (current_task == '2') {
            // Creating new predicate
            if (fan_task == '1') {
                $(t_selector).toggleClass('marked');

                if (is_frame) {
                    activatePredicate(term_selector);
                }

                var type = $('#ic-typ-select').val();
                var language = $('#ic-lan-select').val();
                var lemma = getLemma();

                if (lemma != undefined) {
                    loadFrames(type, language, lemma, function(data) {
                        renderDropdownWithGroups('#fan-type-select', data,
                            ['definition', 'framenet'], '-Pick frame-');
                    });
                }
            } else if (fan_task == '2') {
                if (is_frame) {
                    $(t_selector).toggleClass('marked');
                    activatePredicate(term_selector);
                }
            }
        }
        
        // Currently annotating frame elements
        else if (current_task == '3') {
            if (predicate_selected) {
                $(t_selector).toggleClass('marked');
            }
        }

        // Currently annotating references
        else if (current_task == '4') {
            if (!is_refering) {
                $(t_selector).toggleClass('marked');
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

    $('#mcn-subdivide-input').on('input', function() {
        updateCPDSubdivide();
    });
    
    // Fill project & type selectors
    $.get('/projects', {}, function(data, status) { 
        var proj = data['proj'];
        var type = data['type'];

        renderDropdown('#ic-pro-select', proj, [], '-Select a project-');
        renderDropdown('#ic-typ-select', type, [], '-Select a project-');
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

function hexToRGB(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
     ] : null;
  }
function getSelected() {
    return $.unique($('.marked').not('.annotated-depends')
        .not('.structured-data').map(function() {
        return $(this).attr('term-selector');
    }).get());
}

function getLemma() {
    return $.unique($('.marked').not('.annotated-depends')
        .not('.structured-data').map(function() {
        return $(this).attr('lemma');
    }).get())[0];
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
    $('sup').hide();
}

function hideInfoPanels() {
    $('#ip-mcn').hide();
    $('#ip-fan').hide();
    $('#ip-fea').hide();
    $('#ip-pre').hide();
}

function clearSelection() {
    if (predicate_selected) {
        $('.annotated').removeClass('.annotated');
    }

    predicate_selected = false;
    $('.styled').removeAttr('style');
    $('.styled').removeClass('styled');
    $('.marked').removeClass('marked');
    $('#mcn-subdivide-input').val('');
    updateCPDSubdivide();    

    if (!enforced_role_annotation) {
        $('span').removeClass('info-marked');
    }
}

function resetSubTasks() {
    $('#mcn-task-select').val('None');
    $('#fan-type-select').val('None');
    $('#fan-relation-select').val('None');
    $('#fea-pred-select').val('None');
    $('#fea-role-select').val('None');
    $('#sde-action-select').val('None');
    $('#sde-relation-select').val('None');
    $('#sde-remove-select').val('None');
}

function restoreDefaults(hard_reset) {
    $('#infoMessage').html('');

    // Empty docs and info panels
    $('#doc-container').html('');
    $('#ip-sdi').html('');
    clearChosenFrameInfo();
    clearChosenRoleInfo();
    clearActivePredicate();

    if (hard_reset) {
        // Reset selection boxes
        $('#annotation-task-selection').val('None');
        resetSubTasks();

        hideSelectors();
        hideInfoPanels();
    }

    // Reset text inputs
    $('#mcn-lemma-input').val('');
    $('#sde-uri-input').val('');
    $('#sde-label-input').val('');

    clearSelection();

    predicate_selected = false;
}

function updateTask() {
    current_task = $('#annotation-task-selection').val();
    $('.annotated').removeClass('annotated');

    resetSubTasks();
    hideSelectors();
    hideInfoPanels();
    clearSelection();
    clearActivePredicate();

    if (current_task == '1') {
        $('.mcn-selectors').show();
        $('.mcn-add-selectors').hide();
        $('.mcn-add-selectors2').hide();
        $('.mcn-add-selectors3').hide();

        $('span[multiword]').addClass('annotated');
        $('span[compound]').addClass('annotated');
    } else if (current_task == '2') {
        $('.fan-selectors').show();

        $(".fan-add-selectors").hide();
        $(".fan-rem-selectors").hide();

        $('span[frame]').addClass('annotated');
    } else if (current_task == '3') {
        $('.fea-selectors').show();
        $('#ip-fea').show();
        $('#ip-pre').show();

        // $('span[role]').addClass('annotated');
        // $('span[frame]').addClass('annotated-depends');
        $('sup').show();
    } else if (current_task == '4') {
        $('span[reference]').addClass('annotated');
    } else if (current_task == '5') {
        $('.sde-selectors').show();
        $('.sde-rem-selectors').hide();
        $('.sde-add-selectors').hide();
    }
}

function updateFANTask() {
    clearSelection();
    fan_task = $("#fan-task-select").val();

    if (fan_task == "1") {
        $('#ip-fan').show();
        $('#ip-pre').show();

        $(".fan-add-selectors").show();
        $(".fan-rem-selectors").hide();
    } else if (fan_task == '2') {
        $('#ip-pre').show();
        $('#ip-fan').hide();
        
        $(".fan-add-selectors").hide();
        $(".fan-rem-selectors").show();
    }
}

function updateFEATask() {
    clearSelection();
    clearActivePredicate();
    
    var fea_tid = $("#fea-pred-select").val();
    $('.annotated').removeClass('annotated')
    activatePredicate(fea_tid);

    var frame = annotations['fan'][fea_tid]['premon'];

    loadRoles(frame, function(data) {
        renderDropdownWithGroups('#fea-role-select', data,
            ['definition', 'framenet'], '-Pick a frame role-');
    });

    if (fea_tid != '-1') {
        predicate_selected = true;
        $('[term-selector=' + fea_tid + ']').addClass('marked annotated depends');
    }
}

function updateSDETask() {
    var task = $("#sde-task-select").val();

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
    
    $('#ip-mcn').hide();

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
        $('#ip-mcn').hide();
        $('.mcn-add-selectors2').show();
        $('.mcn-add-selectors3').hide();
    } else if(mcn_type == '3') {
        $('#ip-mcn').show();
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

            token_sp = '<span id=' + id + '_t>' + token + '</span>';
            var lem_input = '<input id=' + id + '_l type="text" class="w-100", value="' + token + '">';
            var pos_input = '<select id=' + id + '_p type="text" class="w-100">' + pos_options + '</select>';
            var hea_input = '<input id=' + id + '_h type="radio" name="head">';

            $('#cpd-subdivisions').append('<tr><td>' + token_sp + '</td>' +
                                              '<td>' + lem_input + '</td>' +
                                              '<td>' + pos_input + '</td>' +
                                              '<td>' + hea_input + '</td></tr>');
        }
    }
}

// =====================================
// UI CONTROLLED =======================
// =====================================

function updateIncidentSelection(changed) {
    var selected_pro = $('#ic-pro-select').val();
    var selected_typ = $('#ic-typ-select').val();
    var selected_inc = $('#ic-inc-select').val();
    var selected_lan = $('#ic-lan-select').val();

    if (changed == 0 || changed == 1) {
        renderDropdown('#ic-lan-select', [], [], '-Select a language-');
        renderDropdown('#ic-lan-select', [], [], '-Select a language-');

        if (selected_pro == 'None' || selected_typ == 'None') {
            renderDropdown('#ic-inc-select', [], [], '-Select an incident-');
        } else {
            var get_data = { 'proj': selected_pro, 'type': selected_typ  };
            $.get('/project_incidents', get_data, function(result, status) {
                var inc = result['inc'];
                renderDropdown('#ic-inc-select', inc, [], '-Select an incident-')
            });
        }
    } else if (changed == 2) {
        renderDropdown('#ic-doc-select', [], [], '-Select a document-');

        if (selected_inc == 'None') {
            renderDropdown('#ic-lan-select', [], [], '-Select a language-');
        } else {
            var get_data = { 'inc': selected_inc };
            $.get('/incident_languages', get_data, function(result, status) {
                var lang = result['lang'];
                renderDropdown('#ic-lan-select', lang, [], '-Select a language-');
            });
        }
    } else if (changed == 3) {
        if (selected_lan == 'None') {
            renderDropdown('#ic-doc-select', [], [], '-Select a document-');
        } else {
            var get_data = { 'inc': selected_inc, 'lan': selected_lan };
            $.get('/incident_documents', get_data, function(result, status) {
                var doc = result['doc'];
                renderDropdown('#ic-doc-select', doc, [], '-Select a document-');
            });
        }
    }
}

function loadDocument() {
    var task = $('#annotation-task-selection').val();
    var hard_reset = task == 'None' || task == '-1'
    console.log(hard_reset);
    console.log(task);

    var inc = $('#ic-inc-select').val();
    var lan = $('#ic-lan-select').val();
    var doc = $('#ic-doc-select').val();

    var inc_txt =$('#ic-inc-select option:selected').text(); 

    if (lan != 'None' && doc != 'None') {
        annotations = {};
        restoreDefaults(hard_reset);
        updateTask();
        
        clearSelection();

        loadNAFFile(inc, lan + '/' + doc, function(result) {
            if (result != 0) {
                annotations['fan'] = result['frames'];
                annotations['fea'] = result['frame_elements'];
                annotations['sdr'] = result['coreferences'];

                renderDocument(result, annotations);
                $('sup').hide();

                var predicates = [];
                for (var key in annotations.fan) {
                    predicates.push({ 'label': annotations.fan[key].predicate, 'value': key })
                }

                renderDropdown('#fea-pred-select', predicates, [], '-Select a predicate-');

                loadStructuredData(inc, function(data) {
                    renderStructuredData(inc, inc_txt, data);

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

                    renderDropdownWithGroups('#sde-remove-select', dropdown_data, [], '-Pick item-')
                });

                // Show controls
                $('#annotation-controls').show();
                $('#content-container').show();
            }
        });
    } else{
        printMessage('Select a document', 'error');
    }
}

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

function renderToken(term, prev_term) {
    if (term.text == '\n') return '<br/>';
    
    var t_select = term.t_select;
    var p_select = term.p_select;
    var join_sym = ' ';
    var super_script = '';

    if (prev_term.typ == 'None') {
        join_sym = '';
    } else if (prev_term.type == 'compound' && term.type == 'compound') {
        join_sym = '_'
    }

    if (term.type.includes('frame')) {
        super_script = '<sup>' + term.pr_id  + '</sup>'
    }

    return join_sym + '<span class="markable ' + term.status + '" lemma="' + term.lemma + '" term-selector="' + t_select + '" parent-selector="' + p_select + '" ' + term.type + '>' + term.text + super_script + '</span>';
}

function renderTokens(terms, annotations) {
    var text = '';
    var prev_term = { 'type': 'None' };

    for (var i in terms) {
        var term = terms[i];
        term.status = '';

        if (term.t_select in annotations['fan']) {
            term.type += ' frame'
            term.pr_id = annotations.fan[term.t_select].predicate;
            term.status = annotations['fan'][term.t_select].status
        } else if (term.t_select in annotations['fea']) {
            term.type += ' role'
        } else if (term.t_select in annotations['sdr']) {
            term.type += ' reference'
        }

        text += renderToken(term, prev_term);
        prev_term = term;
    }

    return text;
}

function renderDocument(doc_data, annotations) {
    // Extract necessary data
    var doc_id = doc_data['name']
    var source = doc_data['source'];

    // Render title
    var title_tokens = doc_data['title'];
    var body_tokens = doc_data['body'];

    var title_render = renderTokens(title_tokens, annotations);
    var body_render = renderTokens(body_tokens, annotations);

    var result = '<div class="panel panel-default" id="' + doc_id + '">';
    result += '<div class="panel-heading"><h4 class="document-title">' + title_render; 
    result += '(<a href="' + source + '">source</a>)';
    result += '</h4></div>';

    // Render body
    result += '<div class="panel-body">';
    result += body_render
    result += '</div></div>';

    $("#doc-container").append(result);
}

function renderStructuredData(incident_id, incident_txt, data) {
    var incident_type_uri = $('#ic-typ-select').val();
    var incident_type_txt = $('#ic-typ-select option:selected').text();
    var incident_type_url = WDT_PREFIX + incident_type_uri;

    var incident_url = WDT_PREFIX + incident_id;

    // Render incident type
    var result = '<label>incident type:</label> ';
    result += '<a href="' + incident_type_url + '" data-uri="' + incident_type_uri + '" target="_blank">' + incident_type_txt + '</a>';
    result += '<br/>';

    // Render incident ID
    result += '<label>incident ID:</label> ';
    result += '<a href="' + incident_url + '" data-uri="' + incident_id + '" data-type="event" class="structured-data" target="_blank">' + incident_txt + '</a>';
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

function renderDropdown(element_id, items, data_items, default_option) {
    var element = $(element_id);

    element.empty();
    element.append($('<option value="None" selected>' + default_option + '</option>'));

    // Add group items
    $.each(items, function(item_index) {
        var item = items[item_index];
        var cur_option = $('<option></option>').attr('value', item['value']).text(item['label'])

        // Add potential data to each option
        for (var data_item_index in data_items) {
            var data_item = data_items[data_item_index];
            cur_option.attr('data-' + data_item, item[data_item]);
        }

        element.append(cur_option);
    });
}


function printMessage(message, type) {
    $('#message').html(message);
    $('#message').removeClass();
    $('#message').addClass(type + '-msg');
}

// =====================================
// RETRIEVE UTILS ======================
// =====================================

function loadNAFFile(incident, document, callback) {
    var get_data = { 'inc': incident, 'doc': document };
    
    $.get('/load_document', get_data, function(result, status) {
        callback(result['naf']);
    }).fail(function(e) {
        // Incident locked
        if (e.status == 423) {
            printMessage('The incident is locked by another user.', 'error');
            callback(0);
        } else {
            printMessage('Something went wrong while loading the requested document.', 'error');
        }
    });
}

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
    var get_data = { 'inc': incident_id };
    $.get('/load_incident_data', get_data, function(result, status) {
        callback(result);
    });
}

function loadFrames(type, language, lemma, callback) {
    var request_data = { 'typ': type, 'lan': language, 'lem': lemma };
    $.get('/frames', request_data, function(result, status) {
        callback(result);
    });
}

function loadRoles(frame, callback) {
    var get_data = { 'frame': frame };

    $.get('/frame_elements', get_data, function(result, status) {
        callback(result);
    });
}

// =====================================
// VALIDATION UTILS ====================
// =====================================
function validateCorrection() {
    var correction_task = mcn_task;
    var correction_type = mcn_type;

    var correction_lemma = $('#mcn-lemma-input').val();
    
    var correction_original = $('.marked').text();
    var correction_subdivisions = $('#mcn-subdivide-input').val().split('|');
    var correction_subdiv_props = [];
    var correction_subdiv_head = -1;
    var correction_subdiv_vali = true;

    var parent_term = $.unique($('.marked').not('.annotated-depends').not('.structured-data').map(function() {
                            return $(this).attr('parent-selector');
                       }).get())[0];

    if (correction_task == '1' && mcn_type == '3') {
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

    if (correction_task == '1' && correction_type == 'None') {
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

            if (correction_subdivisions.join('') != correction_original) {
                return [false, 'Compound components should recreate entire compound'];
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
            var task_data = { 'mcn_task': correction_task,
                              'mcn_type': correction_type,
                              'lemma': correction_lemma,
                              'target_ids': selected };

            return[true, task_data];
        } else {
            var task_data = { 'mcn_task': correction_task,
                              'mcn_type': correction_type,
                              'target_id': selected[0],
                              'head': correction_subdiv_head,
                              'subterms': correction_subdiv_props };

            return[true, task_data];
        }
    }

    // Remove
    else {
        // If parent term starts with 'mw': multiword, compound otherwise
        correction_type = parent_term.startsWith('mw') ? 1 : 2

        var task_data = { 'mcn_task': correction_task,
                          'mcn_type': correction_type,
                          'target_id': parent_term };

        return[true, task_data];
    }
}

function validateFrameAnnotation() {
    var frame_task = $('#fan-task-select').val();
    var frame_type = $('#fan-type-select').val();
    var frame_relation = $('#fan-relation-select').val();

    var has_lu = $('#fan-type-select').data('lu') != '';

    if (frame_task == 'None') {
        return [false, 'Please select an annotation task']
    }

    if (frame_task == '1') {
        if (frame_type == 'None') {
            return [false, 'Please pick a frame type'];
        } else if (frame_relation == 'None') {
            return [false, 'Please pick a frame relation type'];
        }

        if (has_lu) {
            var lu_reference = $('#fan-type-select').data('lu-ref');
            var lu_resource = $('#fan-type-select').data('lu-res');
        }
    }

    // Get all selected markables
    var selected = getSelected();

    if (!(selected.length > 0)) {
        return [false, 'Please select at least one markable'];
    }

    // Create
    if (frame_task == '1') {
        var task_data = { 'fan_task': 1,
                          'frame': frame_type,
                          'type': frame_relation,
                          'target_ids': selected,
                          'has_lu': has_lu,
                          'lu': lu_reference,
                          'lu_resource': lu_resource };

        return [true, task_data];
    }
    // Remove
    else {
        var predicates = selected.map(function(term) {
            return annotations.fan[term].predicate;
        });

        var task_data = { 'fan_task': 2, 'target_ids': predicates };
        
        return [true, task_data];
    }
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
        } else {
            selected = 'unexpressed';
        }
    }

    var tid = $('.annotated.depends.marked').attr('term-selector');
    console.log(tid)
    var pr_id = annotations['fan'][tid]['predicate'];
    
    var task_data = { 'pr_id': pr_id, 'role': role, 'target_ids': selected };
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

    var task_data = { 'target_ids': selected, 'reference': referent_uri, 'type': referent_type };
    return[true, task_data];
}

var validateStructuredData = function() {
    var action = $("#sde-task-select").val();

    if (action == 'None') {
        return [false, 'Select data annotation action'];
    } else if (action == "1") {
        var relation = $("#sde-relation-select").val();
        var wdt_uri = $('#sde-uri-input').val();
        var label = $('#sde-label-input').val();

        if (relation == 'None') {
            return [false, 'Select a relation type'];
        }

        if (!(wdt_uri.startsWith('Q'))) {
            return [false, 'Wikdidata identifier must start with Q']
        }

        wdt_uri = 'http://www.wikidata.org/entity/' + wdt_uri;

        if (label == '') {
            return [false, 'No label specified'];
        }

        var task_data = { 'action': 1, 'relation': relation, 'wdt_uri': wdt_uri, 'label': label }
        return [true, task_data ]
    } else {
        var item = $("#sde-remove-select").val().split(';');
        var rel = item[0];
        var val = item[1];

        if (item == 'None') {
            return [false, 'Select an item to remove'];
        }

        var task_data = { 'action': 2, 'relation': rel, 'item': val };
        return [true, task_data ]
    }
}

// =====================================
// STORE UTILS =========================
// =====================================

function storeAndReload(task_data) {
    var inc = $('#ic-inc-select').val();
    var lan = $('#ic-lan-select').val();
    var doc = $('#ic-doc-select').val();
    var request_data = { 'inc': inc, 'lan': lan, 'doc': doc, 'tid': current_task, 'tda': task_data };

    $.post('/store_annotation', request_data).done(function(result) {
        printMessage('Successfully saved annotations', 'success');
        loadDocument();
    }).fail(function(err) {
        printMessage('There was an error while saving your annotations', 'warning');
    });
}

// =====================================
// UTILS ===============================
// =====================================

function activatePredicate(token_id) {
    clearActivePredicate();

    // Get information from annotation
    var info = annotations['fan'][token_id];


    // Set predicate summary
    $('#active-frame-label').text(info.label);
    $('#active-frame-pre').text(info.premon);
    $('#active-frame-pre').attr('href', info.premon);
    $('#active-frame-frn').text(info.framenet);
    $('#active-frame-frn').attr('href', info.framenet);
    $('#activePredicate').text(info.predicate);

    var an_un = [];
    for (var i in annotations['fea']['unexpressed']) {
        var frame_element = annotations['fea']['unexpressed'][i];

        if (frame_element['predicate'] == info.predicate) {
            an_un.push(frame_element['premon']);
        }
    }
    
    var an_ex = {};
    for (var i in annotations['fea']) {
        if (i != 'unexpressed') {
            var frame_element = annotations['fea'][i];

            if (frame_element['predicate'] == info.predicate) {
                an_ex[frame_element['premon']] = i;
            }
        }
    }

    loadRoles(info.premon, function(result) {
        var color_index = 0;
        color_index = activateRoles(result, 'Core', an_ex, an_un, true, color_index);
        color_index = activateRoles(result, 'Peripheral', an_ex, an_un, false, color_index);
        color_index = activateRoles(result, 'Extra-thematic', an_ex, an_un, false, color_index);
        color_index = activateRoles(result, 'Core-unexpressed', an_ex, an_un, false), color_index;
    });
}

function activateRoles(datasource, type, an_ex, an_un, show, color_index) {
    data = datasource[type];
    for (var i in data) {
        var bg_color = CONTRASTING_COLORS[color_index];
        var fg_color = '#000000';

        if (contrastRatio(hexToRGB(bg_color), hexToRGB(fg_color)) < 5) {
            fg_color = '#ffffff';
        }

        var annotated = false;
        var expressed = false;

        if (an_un.indexOf(data[i]['value']) > -1) {
            annotated = true;
        } else if (data[i]['value'] in an_ex) {
            annotated = true;
            expressed = true;

            var t_select = an_ex[data[i]['value']];

            $('[term-selector=' + t_select + ']').addClass('styled');
            $('[term-selector=' + t_select + ']').css('background-color', bg_color);
            $('[term-selector=' + t_select + ']').css('color', fg_color);
        }
        
        if (annotated || show) {
            var new_row = $('<tr></tr>');
            new_row.css('background-color', bg_color);
            new_row.css('color', fg_color);
            new_row.append('<td>' + data[i]['label'] + '</td>');
            new_row.append('<td>' + type + '</td>');
            new_row.append('<td>' + annotated + '</td>');
            new_row.append('<td>' + expressed + '</td>');

            $('#selectedPredicateRoleInfo').append(new_row);

            color_index += 1;
        }
    }

    return color_index
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

var clearActivePredicate = function() {
    $('#active-frame-label').text('');
    $('#active-frame-pre').text('');
    $('#active-frame-pre').attr('href', '#');
    $('#active-frame-frn').text('');
    $('#active-frame-frn').attr('href', '#');
    $('#active-predicate-id').text('');
    $('#selectedPredicateRoleInfo').find('tr:gt(0)').remove();
}