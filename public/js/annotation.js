wdt_prefix = 'http://wikidata.org/wiki/';
type2Label = {'Q132821': 'murder', 'Q168983': 'conflagration'};

annotations = {};
referents = [];

current_task = '-1';

enforced_role_annotation = false;

modifying_predicate_span = false;
modifying_predicate_roles = false;

selected_predicate_span = [];

noFrameType = 'NO-FRAME';

$(function() {
    $('#annrow').hide();
    $('#bigdiv').hide();

    // On click markable
    $(document).on('click', 'span.markable', function() {
        // Get all tokens with same term id
        var term_selector = $(this).attr('term-selector');
        var selector = '[term-selector="' + term_selector + '"]';

        var is_annotated = $(selector).hasClass('annotated');
        
        // Currently markable correction
        if (current_task == '1') {
            $(selector).toggleClass('marked');
        }

        // Currently annotating frames
        else if (current_task == '2') {
            if (!is_annotated) {
                // Currently not modifying a predicate span
                if (!modifying_predicate_span) {
                    // Make selected markable marked
                    $(selector).toggleClass('marked');
                } else {
                    // Keep selection and make selecte markable marked
                    $(selector).toggleClass('marked');
                }
            } else {
                // Currently not modifying a predicate span
                if (!modifying_predicate_span) {
                    modifying_predicate_span = true;
                    clearSelection();

                    $(selector).addClass('base');
                    activatePredicateFromText($(this));

                    selected_predicate_span = $('.marked').map(function() {
                        return $(this).attr('id');
                    }).get();
                } else {
                    var marked_predicate_id = $(this).attr('id');
                    
                    // Only allow terms in predicate span to be clicked
                    if (selected_predicate_span.includes(marked_predicate_id)) {
                        var is_modification_base = $(selector).hasClass('base');

                        // Selected markable is not first selected term in predicate
                        if (!is_modification_base) {
                            $(selector).toggleClass('marked');
                        } else {
                            clearSelection();
                            modifying_predicate_span = false;
                        }
                    }
                }
            }
        }
        
        // Currently annotating frame elements
        else if (current_task == '3') {
            var has_role = $(selector).hasClass('role');

            // Mark items not in the predicate span as roles
            if (!is_annotated && !has_role) {
                if (modifying_predicate_roles) {
                    $(selector).toggleClass('marked');
                }
            } else if(!is_annotated && has_role) {
                if (modifying_predicate_roles) {
                    $(selector).toggleClass('marked');
                }
            } else {
                if (!enforced_role_annotation) {
                    // Activate current clicked predicate
                    if (!modifying_predicate_roles) {
                        activatePredicateFromText($(this));
                        modifying_predicate_roles = true;

                        selected_predicate_span = $('.marked').map(function() {
                            return $(this).attr('id');
                        }).get();
                    } else {
                        // Deactivate if predicate is clicked again
                        var marked_predicate_id = $(this).attr('id');

                        // Only allow terms in predicate span to be clicked
                        if (selected_predicate_span.includes(marked_predicate_id)) {
                            clearSelection();
                            modifying_predicate_roles = false;
                        }
                    }
                }
            }
        }

        // Currently annotating references
        else if (current_task == '4') {
            $(selector).toggleClass('marked');

            if (is_annotated) {
                activateReferent($(this));
            }
        }
    });

    $(document).on('click', 'a.structured-data', function(e) {
        if (current_task == '4') {
            if (!e.ctrlKey && !e.metaKey){
                e.preventDefault();
                
                if (!$(this).hasClass('referent')) {
                    $('.referent').removeClass('referent');
                    $(this).addClass('referent');
                } else {
                    $('.referent').removeClass('referent');
                }
            }
        }
    });
    
    $.get('/projects', {}, function(data, status) { 
        var projects = data['projects'];
        var types = data['types'];

        for(var i = 0; i < projects.length; i++) {
            $('#pickproj').append($('<option></option>').val(projects[i]).html(projects[i]));
        }

        for(var i = 0; i < types.length; i++) {
            var typeLabel = type2Label[types[i]];
            $('#picktype').append($('<option></option>').val(types[i]).html(typeLabel));
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

var arraysMatch = function (arr1, arr2) {
    if (arr1.length != arr2.length)
        return false;

	for (var i = 0; i < arr1.length; i++)
        if (arr1[i] !== arr2[i])
            return false;

	return true;
};

// =====================================
// UTILS ===============================
// =====================================

var updateTask = function() {
    current_task = $('#taskSelector').val();

    $('.correctionSelectors').hide();
    $('.frameSelectors').hide();
    $('.elementSelectors').hide();
    $('[data-ref!=""][data-ref]').removeClass('annotated');

    if (current_task == '1') {
        $('.correctionSelectors').show();
    } else if (current_task == '2') {
        loadFrames();
        $('.frameSelectors').show();
    } else if (current_task == '3') {
        $('.elementSelectors').show();
    } else if (current_task == '4') {
        $('[data-ref!=""][data-ref]').addClass('annotated');
    }

    clearSelection();
    clearChosenFrameInfo();
    clearChosenRoleInfo();
    clearRoleDropdown();
}

var loadFrames = function() {
    $.get('/get_frames', function(data, status) {
        reloadDropdownWithGroups('#frameChooser', data, ['definition', 'framenet'], '-Pick frame-');
    });
}

var clearSelection = function() {
    $('span').removeClass('marked');
    $('a').removeClass('referent');

    if (!enforced_role_annotation) {
        $('span').removeClass('base');
        $('span').removeClass('info-marked');
        $('span').attr('style', '');

        clearActiveRoleTable();
    }

    selected_predicate_span = [];
}

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
    return $('#pnlLeft span[id=\"' + unique2tool[docId + '#' + tid] + '\"]');
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

var updateIncidentList = function() {
    var selected_project = $('#pickproj').val();
    var selected_type = $('#picktype').val();

    if (selected_project != '-1' && selected_type != '-1'){
        $.get('/get_project_incidents', { 'project': selected_project, 'type': selected_type }, function(unsorted, status) {
            var old_inc = unsorted['old'];
            var new_inc = unsorted['new'];
            var old_sorted = old_inc.sort();
            var new_sorted = new_inc.sort();
            
            reloadDropdown('#pickfile', new_sorted, '-Pick an incident ID-');
        });
    } else{
        reloadDropdown('#pickfile', [], '-Pick an incident ID-');
    }
}

var updateChosenFrameInfo = function() {
    var chosen_frame = $('#frameChooser option:selected').text();
    var chosen_frame_premon = $('#frameChooser option:selected').val();
    var chosen_frame_framenet = $('#frameChooser option:selected').attr('data-framenet');
    var chosen_frame_definition = $('#frameChooser option:selected').attr('data-definition');

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
    var chosen_role = $('#roleChooser option:selected').text();
    var chosen_role_premon = $('#roleChooser option:selected').val();
    var chosen_role_framenet = $('#roleChooser option:selected').attr('data-framenet');
    var chosen_role_definition = $('#roleChooser option:selected').attr('data-definition');

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

var printInfo = function(msg){
    $('#infoMessage').html(msg);
    $('#infoMessage').removeClass('good_info');
    $('#infoMessage').addClass('bad_info');
}

var renderStructuredData = function(incident_uri, data){
    var str_html = '';
    var allValues = new Set();

    var incident_type_uri = $('#picktype').val();
    var incident_type_url = wdt_prefix + incident_type_uri;
    var incident_type_label = type2Label[incident_type_uri] || incident_type_uri;

    var incident_url = wdt_prefix + incident_uri;

    str_html += '<label id="incType">incident type:</label> ';
    str_html += '<a href="' + incident_type_url + '" data-uri="' + incident_type_uri + '" data-type="event" class="structured-data">' + incident_type_label + '</a>';
    str_html += '<br/>';

    str_html += '<label id="incId">incident ID:</label> ';
    str_html += '<a href="' + incident_url + '" data-uri="' + incident_uri + '" data-type="event" class="structured-data">' + incident_uri + '</a>';
    str_html += '<br/>';

    for (var property in data) {
        var vals = data[property];
        var split_data = property.split(':');

        if (split_data[0] == 'pm')
            continue;

        var clean_property = split_data[1];
        str_html += '<label id="strloc">' + clean_property + ':</label> ';

        for (var i = 0; i < vals.length; i++) {
            var splitted = vals[i].split('|');

            if (i > 0)
                str_html += ', ';

            var valLink = splitted[0];
            var valText = splitted[1];

            if ($.trim(valText) == '')
                str_html += valLink;
            else
                str_html += '<a href="' + valLink + '" data-uri="' + valLink.split('/').slice(-1)[0]  + '" data-type="' + clean_property + '" class="structured-data" target="_blank">' + valText + '</a>';

            allValues.add(vals[i]);
        }

        str_html+='<br/>';
    }

    $('#strinfo').html(str_html);
}

var getStructuredData = function(inc){
    $.get('/get_structured_data', { 'incident': inc }, function(data, status) {
        //var data=JSON.parse(data);
        renderStructuredData(inc, data);
    });
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

var addToken = function(token_id, token, annotated, refs, lus, parent_term) {
    if (token == '\n') return '<br/>';

    else {
        var short_token_id = token_id.split('.')[2];
        var doc_and_sent = token_id.split('.').slice(0, 2);
        var term_selector = token_id;
        var reference = '';
        var ann_class = '';

        if (refs[parent_term]) {
            reference = 'data-ref=' + refs[parent_term];
        }

        if (parent_term != 'none' && parent_term != 'undefined') {
            term_selector = doc_and_sent + '.' + parent_term;
            term_selector = term_selector.replace(',', '.');
        }
        
        // Frame annotation for current token
        if (annotated['frames'][short_token_id] || annotated['frames'][parent_term]) {
            ann_class = 'annotated';
        }

        return '<span id=' + token_id + ' class="markable ' + ann_class + '" ' + reference + ' term-selector="' + term_selector + '">' + token + '</span> ';
    }
}

var addTokens = function(tokens, docId, anns, refs, lus){
    var text = '';

    for (var token_num in tokens) {
        var token_info = tokens[token_num];
        var parent_term = token_info.parent_term;
        var tokenId = docId.replace(/ /g, '_') + '.' + token_info.sent + '.' + token_info.tid;
        var newToken = addToken(tokenId, token_info.text, anns, refs, lus, parent_term);
        var uniqueId = docId.replace(/ /g, '_') + '#' + token_info.tid;

        unique2tool[uniqueId] = tokenId;
        text += newToken;
    }

    return text;
}

var loadTextsFromFile = function(incident_id, callback){
    $('#pnlLeft').html('');

    $.get('/load_incident', { 'incident': incident_id }, function(res, status) {
        unique2tool = {};
        var all_html = ''; 
        var c = 0;
        var data = res['nafs'];
        //var lus=res['lus'];

        // Load each document
        for (var doc_num in data) {
            var docId = data[doc_num]['name'];
            var docLang = docId.split('/')[0];
            var lusLang = [];

            annotations[docId] = data[doc_num]['annotations'];

            var source = data[doc_num]['source'];
            var sourcetype = data[doc_num]['sourcetype'];

            var title_tokens = data[doc_num]['title'];
            title = addTokens(title_tokens, docId, data[doc_num]['annotations'], data[doc_num]['references'], lusLang);

            var header = '<div class="panel panel-default" id="' + doc_num + '">';
            header += '<div class="panel-heading"><h4 class="panel-title">' + title; 
            header += '(' + sourcetype + ' RT; <a href="' + source + '">' + source + '</a>)';
            header += '</h4></div>';

            var body = '<div class="panel-body">';
            var body_tokens = data[doc_num]['body'];
            body += addTokens(body_tokens, docId, data[doc_num]['annotations'], data[doc_num]['references'], lusLang);
            body += '</div></div>';

            all_html += header + body;    
        }

        $('#pnlLeft').html(all_html);
        if (Object.keys(annotations).length == data.length){ 
            callback();
        }

        $('#bigdiv').height($(window).height()-($('#pickrow').height() + $('#titlerow').height()+$('#annrow').height())-20);
    }).fail(function(e) {
        console.log(e.status)
        // Incident locked
        if (e.status == 423) {
            alert('The incident you tried to load is locked by another user.');
            return;
        }
    });
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

var loadIncident = function(){
    var inc = $('#pickfile').val();

    if (inc != '-1') {
        annotations = {};
        defaultValues();
        clearSelection();

        loadTextsFromFile(inc, function() {
            $('#incid').html(inc);
            $('#infoMessage').html('');

            getStructuredData(inc);
            $('#annrow').show();
            $('#bigdiv').show();
            $('.frameSelectors').hide();
            $('.elementSelectors').hide();
            $('#activeFrame').text('none');
            $('#activePredicate').text('');
            $('#taskSelector').val('-1');
            showAnnotations();
        });
    } else{
        printInfo('Please select an incident');
    }
}

var defaultValues = function(){
    $('#taskSelector').val('-1');
    $('#frameChooser').val('-1');
    $('#relChooser').val('-1');
    $('#correctionChooser').val('-1');
    $('.correctionSelectors').hide();
    $('.frameSelectorss').hide();
    $('.elementSelectors').hide();
    $('#referents').html('');
    $('.referent').removeClass('referent');
    $('#activeRole').text('');

    clearChosenFrameInfo();
    clearChosenRoleInfo();
    clearActiveRoleTable();

    modifying_predicate_span = false;
    modifying_predicate_roles = false;
    referents = [];
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

                annotations[docId]['frames'][tid] = { 'premon': $('#frameChooser').val(), 'predicate': 'pr' + (maxPredicateId + 1).toString() };
            }

            showAnnotations();

            data_event = $('#frameChooser').val();
            $('span.marked').attr('data-event', data_event);

            $('span.marked').removeClass().addClass('markable').addClass('annotated');
        }

        current_task = 'none';
    }
}

var reloadDropdown = function(elementId, sourceList, defaultOption){
    var $el = $(elementId);
    $el.empty(); // remove old options
    $el.append($('<option value="-1" selected>' + defaultOption + '</option>'));
    if (sourceList && sourceList.length){
        $.each(sourceList, function(anIndex) {
            var unit = sourceList[anIndex];
            $el.append($('<option></option>')
                .attr('value', unit).text(unit));
        });
    }
}

var reloadDropdownWithGroups = function(element_id, items, data_items, default_option){
    var $el = $(element_id);

    $el.empty();
    $el.append($('<option value="-1" selected>' + default_option + '</option>'));

    for (var group in items) {
        var group_items = items[group];

        // Add group header
        $el.append($('<option></option>').val('-1').html(group).prop('disabled', true));

        // Add group items
        $.each(group_items, function(item_index) {
            var item = group_items[item_index];
            var cur_option = $('<option></option>').attr('value', item['value']).text(item['label'])

            // Add potential data to each option
            for (var data_item_index in data_items) {
                var data_item = data_items[data_item_index];
                cur_option.attr('data-' + data_item, item[data_item]);
            }

            $el.append(cur_option);
        });
    }
}

var updateRoleDropdown = function(frame) {
    $.get('/get_frame_elements', { 'frame': frame }, function(data, status) {
        reloadDropdownWithGroups('#roleChooser', data, ['definition', 'framenet'], '-Pick a frame role-');
    });
}

var clearRoleDropdown = function() {
    reloadDropdownWithGroups('#roleChooser', {}, [], '-Pick a frame role-');
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

var validateCorrection = function() {
    var correction_task = $('#correctionChooser').val();
    var correction_lemma = $('#correctionLemma').val();

    if (correction_task == '-1') {
        return [false, 'Please pick a correction type'];
    }

    // Get all selected markables
    var selected = $('.marked').map(function() {
        return $(this).attr('term-selector');
    }).get();

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
        var incident = $('#pickfile').val();
        var task_data = { 'lemma': correction_lemma, 'tokens': selected };

        return[true, { 'incident': incident, 'doc_id': doc_id, 'task': correction_task, 'task_data': task_data }];
    }

    // Remove
    else if (correction_task == '2' || correction_task == '4') {
        var doc_id = selected[0].split('.')[0].replace(/_/g, ' ');
        var incident = $('#pickfile').val();
        var task_data = { 'term_id': parent_term, 'components': selected };

        return[true, { 'incident': incident, 'doc_id': doc_id, 'task': correction_task, 'task_data': task_data }];
    }
}

var validateAnnotation = function() {
    // Frame annotation
    if (current_task == '2') {
        // Frame not chosen
        if ($('#frameChooser').val() == '-1') {
            return [false, 'Please pick a frame'];
        }
        
        // Relation not chosen
        else if ($('#relChooser').val() == '-1') {
            return [false, 'Please pick a frame relation type'];
        }
    }
    
    // Role annotation
    else if (current_task == '3') {
        if ($('#roleChooser').val() == '-1') {
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
        var frame = $('#frameChooser').val();
        var reltype = $('#relChooser').val();

        annotationData = { 'anntype': current_task, 'doc_id': doc_id, 'frame': frame, 'reltype': reltype, 'mentions': selected, 'referents': wdtLinks, 'predicate': activePredicate};
    } else if (current_task == '3') {
        var role = $('#roleChooser').val();

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
    var selected = $('.marked').map(function() {
        return $(this).attr('term-selector');
    }).get();

    var selected_unique = [];
    $.each(selected, function(i, el){
        if($.inArray(el, selected_unique) === -1) selected_unique.push(el);
    });

    if (!(selected.length > 0)) {
        return [false, 'Select at least one markable']
    }

    // Get all selected referents
    var referent = $('.referent').data('uri');
    var type = $('.referent').data('type');

    if (referent == undefined) {
        return [false, 'Select a referent'];
    }

    var doc_id = selected_unique[0].split('.')[0].replace(/_/g, ' ');
    var incident = $('#pickfile').val();
    var task_data = { 'terms': selected_unique, 'referent': referent, 'type': type };

    return[true, { 'incident': incident, 'doc_id': doc_id, 'task': 1, 'task_data': task_data }];
}

var storeCorrectionsAndReload = function(correction_data) {
    $.post('/store_markable_correction', correction_data).done(function(result) {
        loadIncident();
    });
}

var storeAnnotationsAndReload = function(ann) {
    $.post('/store_annotations', {'annotations': ann, 'incident': $('#pickfile').val() }).done(function(myData) {
        alert( 'Annotation saved. Now re-loading.' );

        var task = current_task;
        
        reloadInside();
        defaultValues();
        clearSelection();

        if (task == '3') {
            checkCoreRolesAnnotation(myData['docid'], myData['prid'], function(core_annotated) {
                console.log(core_annotated);
                if (!core_annotated) {
                    enforced_role_annotation = true;
                    modifying_predicate_roles = true;

                    $('#taskSelector').val('3');
                    updateTask();

                    $('#taskSelector').prop('disabled', true);
                    activatePredicateById(myData['docid'], myData['prid']);
                } else {
                    enforced_role_annotation = false;
                    $('#taskSelector').prop('disabled', false);
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

var validateAndSave = function() {
    // No task selected
    if (current_task == '-1'){
        return printInfo('Please pick an annotation type');
    }

    // Markable correction selected
    else if (current_task == '1') {
        var validation = validateCorrection();

        if (validation[0]) {
            storeCorrectionsAndReload(validation[1]);
        } else {
            printInfo(validation[1])
        }
    }

    // Frame annotation or frame element annotation selected
    else if (current_task == '2' || current_task == '3') {
        var validation = validateAnnotation();

        if (validation[0]) {
            storeAnnotationsAndReload(validation[1]);
        } else {
            printInfo(validation[1]);
        }
    }

    // Reference annotation selected
    else {
        var validation = validateReference();

        if (validation[0]) {
            console.log(validation[1])
            storeReferenceAndReload(validation[1]);
        } else {
            printInfo(validation[1])
        }
    }
}
