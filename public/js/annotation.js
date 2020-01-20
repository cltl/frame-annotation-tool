annotations = {};
referents = [];
wdt_prefix = "http://wikidata.org/wiki/";
type2Label = {'Q132821': 'murder', 'Q168983': 'conflagration'};

modifying_predicate_span = false;
//old_predicate_span = [];

noFrameType = "NO-FRAME";

$(function() {
    $("#annrow").hide();
    $("#bigdiv").hide();

    // On click markable
    $(document).on("click", "span.markable", function() {
        var is_annotated = $(this).hasClass("annotated");

        // Not yet annotated
        if (!is_annotated) {
            // Currently not modifying a predicate span
            if (!modifying_predicate_span) {
                // Make selected markable marked
                $(this).toggleClass("marked");
                } else {
                // Keep selection and make selecte markable marked
                $(this).toggleClass("marked");
                }
            } else {
            // Currently not modifying a predicate span
            if (!modifying_predicate_span) {
                modifying_predicate_span = true;
                clearSelection();

                $(this).addClass("base");
                    activatePredicateFromText($(this));

                old_predicate_span = $(".marked").map(function() {
                return $(this).attr('id');
            }).get();
        } else {
                var marked_predicate_id = $(this).attr("id");

                // Only allow terms in predicate span to be clicked
                if (old_predicate_span.includes(marked_predicate_id)) {
                    var is_modification_base = $(this).hasClass("base");

                    // Selected markable is not first selected term in predicate
                    if (!is_modification_base) {
                        $(this).toggleClass("marked");
                } else {
                        clearSelection();
                        modifying_predicate_span = false;
                }
            }
        }
        }
    });

    $("#anntype").on('change', function(){
	    if (this.value == 'fee'){
            $("#feAnnotation").hide();
            loadFrames();
            $("#frameAnnotation").show();
	    } else if (this.value=='role'){ 
            $("#frameAnnotation").hide();
            $("#feAnnotation").show();        
        } else {
            $("#feAnnotation").hide();
		    $("#frameAnnotation").hide();
	    }
    });
    
    $.get('/listprojectsandtypes', {}, function(data, status) { 
        var projects=data['proj'];
        var types=data['types'];
        for(var i = 0; i < projects.length; i++) {
            $('#pickproj').append($('<option></option>').val(projects[i]).html(projects[i]));
        }

        for(var i = 0; i < types.length; i++) {
            var typeLabel=type2Label[types[i]];
            $('#picktype').append($('<option></option>').val(types[i]).html(typeLabel));
        }
    });
}); // This is where the load function ends!

/*
jQuery.expr[':'].regex = function(elem, index, match) {
    var matchParams = match[3].split(','),
        validLabels = /^(data|css):/,
        attr = {
            method: matchParams[0].match(validLabels) ? 
                        matchParams[0].split(':')[0] : 'attr',
            property: matchParams.shift().replace(validLabels,'')
        },
        regexFlags = 'ig',
        regex = new RegExp(matchParams.join('').replace(/^\s+|\s+$/g,''), regexFlags);
    return regex.test(jQuery(elem)[attr.method](attr.property));
}
*/

var arraysMatch = function (arr1, arr2) {
    if (arr1.length != arr2.length)
        return false;

	for (var i = 0; i < arr1.length; i++)
        if (arr1[i] !== arr2[i])
            return false;

	return true;
};

var loadFrames = function() {
    var etype = $("#picktype").val();
    $.get('/get_frames', {'eventtype': etype}, function(data, status) {
        reloadDropdownWithGroups("#frameChooser", data, ['definition', 'framenet'], "-Pick frame-");
    });
}

var clearSelection = function() {
    $("span").removeClass("marked");
    $("span").removeClass("annotated-marked");
    $("span").removeClass("base");
}

var activatePredicateRightPanel = function(theId) {
    $('span').removeClass("active");
    var htmlElem=$("span[id='" + theId + "']");
    var wasInactive=htmlElem.hasClass("inactive");
    $('span').removeClass("inactive");
    $('span').removeClass("role");
    if (!wasInactive){
        var elems=theId.split('#');
        var docId = elems[0].replace(/_/g, " ");
        var tid = elems[1];
        activatePredicate(docId, tid);
    } 
}

// Color all nessecary markables on screen when 
// a markable in the text is clicked
var activatePredicateFromText = function(elem) {
    // Get document id and token id
    var element_id = elem.attr('id');
    var document_id = element_id.split('.')[0].replace(/_/g, " ");
    var token_id = element_id.split('.')[2];

    activatePredicate(document_id, token_id);
}

var activateRoleFromText = function(elem) {
    var aMention=elem.attr('id');
    var docIdUnderscore=aMention.split('.')[0];
    var tid=aMention.split('.')[2];
    var roleId=currentPredRoles[tid];
    $('#activeRole').text(roleId);
//    elem.addClass('inactive');
    jQuery.each(currentPredRoles, function(t, rlid) {
        if (rlid==roleId){
            var $roleMention=selectSpanUniqueID(docIdUnderscore, t);
            $roleMention.addClass('inactive');
            $("span[id='" + docIdUnderscore + "#" + t + "']").addClass('inactive');
        }
    });

}

var selectSpanUniqueID = function(docId, tid){
    return $("#pnlLeft span[id='" + unique2tool[docId + '#' + tid] + "']");
}

/*
var selectSpanByRegex=function(start, end){
    //var selector = "#pnlLeft span[id$='" + start + "'][id^='" + end + "']";
    var selector='span:regex(id,^' + start + '(.*)' + end + '$)';
    return $(selector);
}
*/

var activatePredicate = function(document_id, token_id){
    // Get information from annotation
    var frame = annotations[document_id][token_id]['frametype'] || noFrameType;
    var predicate_id = annotations[document_id][token_id]['predicate'];
    var display_predicate = document_id + '@' + predicate_id;
    var referents = annotations[document_id][token_id]["referents"];
    
    // Set predicate summary
    $("#activeFrame").text(frame);
    $("#activePredicate").text(display_predicate);
    $("#frameWdt").html(referents.join('<br/>'));
    
    var document_annotations = annotations[document_id];
    var display_document_id = document_id.replace(/ /g, "_");

    // TODO: Update frame elements dropdown 

    // Loop over all annotations
    for (var annotation_id in document_annotations) {
        var annotation = document_annotations[annotation_id];

        if (annotation["predicate"] == predicate_id) {
            var predicate_markable = selectSpanUniqueID(display_document_id, annotation_id);
            predicate_markable.addClass('marked');
            $("span[id=\"" + display_document_id + "#" + annotation_id + "\"]").addClass("marked");
            console.log("span[id=\"" + display_document_id + "#" + annotation_id + "\"]");
        }
        } 
}

var confirmPreannotated=function(){

}

var updateIncidentList=function() {
    var pickedType=$('#picktype').val();
    var pickedProj=$('#pickproj').val();
    if (pickedType!='-1' && pickedProj!='-1'){
        $.get('/listincidents', {'myproj': pickedProj, 'mytype': pickedType}, function(unsorted, status) {
            var old_inc = unsorted['old'];
            var new_inc = unsorted['new'];
            var old_sorted = old_inc.sort();
            var new_sorted = new_inc.sort();
            
            reloadDropdown("#pickfile", new_sorted, "-Pick an incident ID-");
        });
    } else{
        reloadDropdown("#pickfile", [], "-Pick an incident ID-");
    }
}

var updateChosenFrameInfo = function () {
    var chosen_frame = $('#frameChooser option:selected').text();
    var chosen_frame_premon = $('#frameChooser option:selected').val();
    var chosen_frame_framenet = $('#frameChooser option:selected').attr('data-framenet');
    var chosen_frame_definition = $('#frameChooser option:selected').attr('data-definition');

    $("#chosenFrameLabel").text(chosen_frame);
    $("#chosenFrameDef").text(chosen_frame_definition);
    $("#chosenFramePrem").attr("href", chosen_frame_premon);
    $("#chosenFramePrem").text("Click here");
    $("#chosenFrameFM").attr("href", chosen_frame_framenet);
    $("#chosenFrameFM").text("Click here");
}

var retrieveSpansWithClass=function(cls){
    var allMentions = $(cls).map(function() {
        return $(this).attr('id');
    }).get();
    return allMentions;
}

var printInfo = function(msg){
        $("#infoMessage").html(msg);
        $("#infoMessage").removeClass("good_info");
        $("#infoMessage").addClass("bad_info");
}

var addReferent = function(){
    var newRef=$("#newReferent").val();
    var inc=$("#pickfile").val();
    $.post('/addreferent', {'newref': newRef, 'inc': inc}) 
    .done(function(data) {
        alert( "New referent saved." );
        $("#newReferent").val('');
        renderStructuredData(inc, data);
    })
    .fail(function(err) {
        alert( "Error! Referent not saved.");
    });
}

var renderStructuredData = function(inc, data){
    var str_html='';
    var allValues = new Set();

    var incTypeId=$("#picktype").val();
    var incTypeLabel=type2Label[incTypeId] || incTypeId;
    
    var incType=wdt_prefix + incTypeId;
    var incId=wdt_prefix + inc;

    str_html += "<label id=\"incType\">incident type:</label> ";
    str_html+="<a href=\"" + incType + "\" class=\"strLink\">" + incTypeLabel + "</a>";
    str_html+="<br/>";

    str_html += "<label id=\"incId\">incident ID:</label> ";
    str_html+="<a href=\"" + incId + "\" class=\"strLink\">" + incId + "</a>";
    str_html+="<br/>";

    for (var property in data) {
        var vals=data[property];
        var split_data=property.split(':');
        if (split_data[0]=='pm') continue;
        var clean_property=split_data[1];
        str_html += "<label id=\"strloc\">" + clean_property + ":</label> ";
        for (var i=0; i<vals.length; i++){
            var splitted=vals[i].split('|');
            if (i>0) str_html += ", ";
            var valLink=splitted[0];
            var valText=splitted[1];
            if ($.trim(valText)=="") str_html+=valLink;
            else str_html += "<a href=\"" + valLink + "\" class=\"strLink\" target=\"_blank\">" + valText + "</a>";
            allValues.add(vals[i]);
        }
        str_html+="<br/>";
    }
    $("#strinfo").html(str_html);

    $(".strLink").click(function(e){
        if (!e.ctrlKey && !e.metaKey){
            e.preventDefault();
            var link=$(this).attr('href');
            var text=$(this).text();
            if ($(this).hasClass('referent')){
                $(this).removeClass('referent');
                var index = referents.indexOf(link + '|' + text);
                if (index !== -1) referents.splice(index, 1);
            } else {
                referents.push(link + '|' + text);
                $(this).addClass('referent');
            }
            var myHtml="";
            referents.forEach(function(ref){
                myHtml+=makeHtml(ref) + '<br/>';
            });
            $("#referents").html(myHtml);
        } else if (!($(this).attr('href').startsWith('http')))
            e.preventDefault();
    });
}

var getStructuredData = function(inc){
    $.get('/getstrdata', {'inc': inc}, function(data, status) {
        //var data=JSON.parse(data);
        renderStructuredData(inc, data);
    });
}

var makeHtml = function(ref){
    var splitted=ref.split('|');
    var valLink=splitted[0];
    var valText=splitted[1];
    if ($.trim(valText)=="") 
        myHtml=valLink;
    else 
        myHtml = "<a href=\"" + valLink + "\" target=\"_blank\">" + valText + "</a>";
    return myHtml;
}

// Add token to a string of spans
var addToken = function(token_id, token, annotated, lus) {
    if (token == '\n') return '<br/>';

    else {
        var short_token_id = token_id.split('.')[2];

        if (!annotated[short_token_id]) {
            return "<span id=" + token_id + " class=\"markable\">" + token + "</span> ";
        } else {
            var frame_type = annotated[short_token_id]['frametype'];
            return "<span id=" + token_id + " data-event=\"" + frame_type + "\" class=\"markable annotated\">" + token + "</span> ";
        }
    }
}

// Add a list of tokens to a string of spans
var addTokens = function(tokens, docId, anns, lus){
    var text = "";

    for (var token_num in tokens) {
        var token_info = tokens[token_num];
        var tokenId = docId.replace(/ /g, "_") + '.' + token_info.sent + '.' + token_info.tid;
        var newToken = addToken(tokenId, token_info.text, anns, lus);
        var uniqueId = docId.replace(/ /g, "_") + '#' + token_info.tid;

        unique2tool[uniqueId] = tokenId;
        text += newToken;
    }

    return text;
}

var loadTextsFromFile = function(inc, callback){
    $("#pnlLeft").html("");

    $.get("/loadincident", {'inc': inc, 'etype': $("#picktype").val()}, function(res, status) {
        unique2tool = {};
        var all_html = ""; 
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
            title = addTokens(title_tokens, docId, data[doc_num]['annotations'], lusLang);

            var header = "<div class=\"panel panel-default\" id=\"" + doc_num + "\">";
            header += "<div class=\"panel-heading\"><h4 class=\"panel-title\">" + title; 
            header += "(" + sourcetype + " RT; <a href=\"" + source + "\">" + source + "</a>)";
            header += "</h4></div>";

            var body = "<div class=\"panel-body\">";
            var body_tokens = data[doc_num]['body'];
            body += addTokens(body_tokens, docId, data[doc_num]['annotations'], lusLang);
            body += "</div></div>";

            all_html += header + body;    
        }

        $("#pnlLeft").html(all_html);
        if (Object.keys(annotations).length==data.length){ 
            callback();
        }

        $("#bigdiv").height($(window).height()-($("#pickrow").height() + $("#titlerow").height()+$("#annrow").height())-20);
    });
}

var showAnnotations = function(){
    $("#trails").html('');
    var html="";
    for (var key in annotations){
        html+="<b>" + key + "</b><br/>";
        for (var ann in annotations[key]){
            var docId=key.replace(/ /g, "_");
            var fullKey=docId + '#' + ann;

            var $elem = selectSpanUniqueID(docId, ann); 
            var aText=$elem.text();
            //var aText='';
            var row = aText + "," + ann + "," + (annotations[key][ann]['frametype'] || noFrameType) + "," + annotations[key][ann]['predicate'];
            html+="<span id=\"" + fullKey + "\" class=\"clickme\" onclick=activatePredicateRightPanel(this.id)>" + row + "</span><br/>";
        }
    }
    $("#trails").html(html);

}

// Load incident - both for mention and structured annotation
var loadIncident = function(){
    var inc = $("#pickfile").val();
    if (inc!="-1"){
        annotations={};
        loadTextsFromFile(inc, function(){
            $("#incid").html(inc);
            $("#infoMessage").html("");
            getStructuredData(inc);
            $("#annrow").show();
            $("#bigdiv").show();
            $("#frameAnnotation").hide();
            $("#feAnnotation").hide();
            $("#activeFrame").text("none");
            $("#activePredicate").text("");
            $("#anntype").val('-1');
            showAnnotations();
        });
    } else{
        printInfo("Please select an incident");
    }
}

// SAVE ANNOTATION
var defaultValues = function(){
    $("#anntype").val('-1');
    $("#frameChooser").val('-1');
    $('#relChooser').val('-1');
    $("#frameAnnotation").hide();
    $("#feAnnotation").hide();
    referents=[];
    $("#referents").html("");
    $(".referent").removeClass("referent");
    $("#activeRole").text('');
}

var getMaxPredicateID=function(docAnnotations){
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

var reloadInside=function(){
    if($("span.active").length>0){
        var actives=$(".active").map(function(){
            return $(this).attr('id');
        }).get();

        var newClass='';
        if ($("#anntype").val()=='fee'){
            var firstDocId = actives[0].split('.')[0].replace(/_/g, ' ');
            var maxPredicateId=getMaxPredicateID(annotations[firstDocId]);
            for (var i=0; i<actives.length; i++){
                var active=actives[i];
                var elems=active.split('.');
                var docId=elems[0].replace(/_/g, ' ');
                var tid=elems[2];
                annotations[docId][tid]={"frametype": $("#frameChooser").val(), "predicate": "pr" + (maxPredicateId+1).toString(), "referents": referents};
                if (i==actives.length-1) showAnnotations();
            }
            newClass = 'event_' + $("#frameChooser").val();
        } else if ($("#anntype").val()=='role'){
            newClass = 'role';
        }
        $("span.active").removeClass().addClass(newClass).addClass("unclickable").addClass("mwu");
    } else if ($("#pnlLeft span.inactive").length>0){
        var mentions=$("#pnlLeft span.inactive").map(function(){
            return $(this).attr('id');
        }).get();
        if ($("#anntype").val()=='fee'){
            for (var i=0; i<mentions.length; i++){
                var token=mentions[i];
                var elems=token.split('.');
                var docId=elems[0].replace(/_/g, ' ');
                var tid=elems[2];
                var activePredicate=$("#activePredicate").text().split('@')[1];
                annotations[docId][tid]={"frametype": $("#frameChooser").val(), "predicate": activePredicate, "referents": referents};
                if (i==mentions.length-1) showAnnotations();
            }
            newClass = 'event_' + $("#frameChooser").val();
        } else if ($("#anntype").val()=='role'){
            for (var i=0; i<mentions.length; i++){
                var token=mentions[i];
                var elems=token.split('.');
                var tid=elems[2];
                var activeRole=$("#activeRole").text();
                currentPredRoles[tid]=activeRole;
            }
            newClass = 'role';
        } 
        //$("span.inactive").children().remove();
        $("#pnlLeft span.inactive").removeClass().addClass('mwu').addClass(newClass).addClass('unclickable');//.addClass("clickable");
    }
}

var reloadDropdown=function(elementId, sourceList, defaultOption){
    var $el = $(elementId);
    $el.empty(); // remove old options
    $el.append($("<option value='-1' selected>" + defaultOption + "</option>"));
    if (sourceList && sourceList.length){
        $.each(sourceList, function(anIndex) {
            var unit = sourceList[anIndex];
            $el.append($("<option></option>")
                .attr("value", unit).text(unit));
        });
    }
}

var reloadDropdownWithGroups = function(element_id, items, data_items, default_option){
    var $el = $(element_id);

    $el.empty();
    $el.append($("<option value='-1' selected>" + default_option + "</option>"));

    for (var group in items) {
        var group_items = items[group];

        // Add group header
        $el.append($('<option></option>').val('-1').html(group).prop('disabled', true));

        // Add group items
        $.each(group_items, function(item_index) {
            var item = group_items[item_index];
            var cur_option = $("<option></option>").attr("value", item['value']).text(item['label'])

            // Add potential data to each option
            for (var data_item_index in data_items) {
                var data_item = data_items[data_item_index];
                cur_option.attr("data-" + data_item, item[data_item]);
            }

            $el.append(cur_option);
        });
    }
}

var refreshRoles = function(theFrame){
    /*
    if (theFrame!='none')
        var relevantRoles = frame2Roles[theFrame];
    else
        var relevantRoles = [];
    reloadDropdown("#roleChooser", relevantRoles, "-Pick frame role-");
    */
}

var storeAndReload = function(ann, anntype){
    console.log("Storing annotations");

    $.post("/storeannotations", {'annotations': ann, 'incident': $("#pickfile").val() })
        .done(function(myData) {
            alert( "Annotation saved. Now re-loading." );
            if (anntype=='fee'){
                var pickedFrame = $("#frameChooser").val();
                $("#activeFrame").text(pickedFrame);
                var pr_id=myData['prid'];
                var doc_id = myData['docid'];
                $("#activePredicate").text(doc_id + '@' + pr_id);
                var myHtml='';
                referents.forEach(function(ref){
                    myHtml+=makeHtml(ref) + '<br/>';
                });

                $("#frameWdt").html(myHtml);

            } else{
                var pickedFrame=$("#activeFrame").text();
            }
            refreshRoles(pickedFrame);
            reloadInside();
            defaultValues();
        })
    .fail(function(err) {
        alert( "There was an error with storing these annotations: " + err );
    });

    $("#infoMessage").html("");
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
    console.log(allMentions);
    var sents = allMentions.map(function(x) {return x.substring(0,x.lastIndexOf('.')); });
    return allValuesSame(sents);
}

var validateAnnotation = function(anntype){
     if (anntype == '-1'){
         return [false, "Please pick an annotation type"];
    } else {
        // Frame annotation
        if (anntype == 'fee') {
            // Frame not chosen
            if ($("#frameChooser").val() == '-1') {
                return [false, "Please pick a frame"];
            }
            
            // Relation not chosen
            else if ($("#relChooser").val()=='-1') {
                return [false, "Please pick a frame relation type"];
            }
        }
        
        // Role annotation
        else if (anntype == 'role') {
            if ($("#roleChooser").val()=='-1') {
                return [false, "Please pick a role"];
            }
        }

        // Get all selected markables
        var selected = $(".active").map(function() {
            return $(this).attr('id');
        }).get();

        var activePredicate = '';
        var allMentions = [];

        if (!(selected.length > 0)) {
            return [false, "Please select at least one mention"];
        }

        // Check if span of predicate has changed
        if (selectionModeModify) {
            if (arraysMatch(selected, modifyingSpan)) {
                activePredicate = ($("#activePredicate").text()).split('@')[1];
            }
        }

        if (!sameSentence(selected)) {
            return [false, "All terms of a frame must be in the same sentence"];
        } else {
            var wdtLinks = referents.map(x => x.split('|')[0]);
            var annotationData = {};

            if (anntype == 'fee'){
                var frame = $("#frameChooser").val();
                var reltype = $("#relChooser").val();
                annotationData = {'anntype': anntype, 'frame': frame, 'reltype': reltype, 'mentions': selected, 'referents': wdtLinks, 'predicate': activePredicate};
            } else if (anntype=='role') {
                var role = $("#activeFrame").text() + "@" + $('#roleChooser').val();
                annotationData = {'anntype': anntype, 'prid': $("#activePredicate").text().split('@')[1], 'mentions': selected, 'semRole': role, 'referents': wdtLinks};
                
                if ($("#activeRole").text())
                    annotationData['rlid'] = $("#activeRole").text();
            } else {
                annotationData = {'anntype': anntype, 'mentions': allMentions};
            }

            return [true, annotationData];
        }
    }
}

var saveFrameAnnotation = function(){
    var anntype = $("#anntype").val();
    var validation = validateAnnotation(anntype);
    var isValid = validation[0];

    if (isValid) {
        console.log('storing ' + JSON.stringify(validation[1]));
        storeAndReload(validation[1], anntype);
    } else {
        printInfo(validation[1]);
    }
}
