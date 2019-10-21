$(function(){
    $("#annrow").hide();
    $("#bigdiv").hide();

    $(document).on("click", "span.clickable", function() {  //use a class, since your ID gets mangled
        $('span').removeClass("inactive");
        $(this).toggleClass("active");      //add the class to the clicked element
    });
    $(document).on("click", "span.unclickable", function() {  //use a class, since your ID gets mangled
        $('span').removeClass("active");
        $(this).toggleClass("inactive");      //add the class to the clicked element
    });

    $("#anntype").on('change', function(){
	    if (this.value=='fee'){
            $("#feAnnotation").hide();
            $("#frameAnnotation").show();
	    } else if (this.value=='role'){ 
            $("#frameAnnotation").hide();
            $("#feAnnotation").show();        
        } else {
            $("#feAnnotation").hide();
		    $("#frameAnnotation").hide();
	    }
	});
    
    $.get('/listincidents', {}, function(unsorted, status) {
        var old_inc = unsorted['old'];
        var new_inc = unsorted['new'];
        var old_sorted = old_inc.sort();
        var new_sorted = new_inc.sort();

        $('#pickfile').append($('<option></option>').val('-1').html("--INCIDENTS YOU'VE WORKED ON--").prop('disabled', true));
        for(var i = 0; i < old_sorted.length; i++) {
            $('#pickfile').append($('<option></option>').val(old_sorted[i]).html(old_sorted[i]));
        }

        $('#pickfile').append($('<option></option>').val('-1').html("--OTHER INCIDENTS--").prop('disabled', true));
        for(var i = 0; i < new_sorted.length; i++) {
            $('#pickfile').append($('<option></option>').val(new_sorted[i]).html(new_sorted[i]));
        }

    });

    frame2Roles={"Killing": ["Cause", "Instrument", "Killer", "Means", "Victim"], 
                "Change_of_leadership": ["Function", "New_leader", "Old_Leader", "Role"]};


    $(".strLink").click(function(e){
        if (e.shiftKey){
            e.preventDefault();
            alert('Shift click');
        }
    });

}); // This is where the load function ends!

annotations={};
wdt_prefix="http://wikidata.org/wiki/";

var clearSelection = function(){
    $('span').removeClass("active");
    $('span').removeClass("inactive");
}

var removeAnnotations = function(){
    if ($("span.inactive").length>0){
        var allMentions = $(".inactive").map(function() {
            return $(this).attr('id');
        }).get();
        var toRemove={};
        for (var i=0; i<allMentions.length; i++){
            var k = allMentions[i];
            var docId=k.split('.')[0];
            if (!(toRemove[docId])) toRemove[docId]=[];
            toRemove[docId].push(k.split('.')[2]);
        }
        $.post("/removeannotations", {'doctokens': toRemove })
        .done(function(){
            alert('Annotation removed. Now re-loading ');
            reloadInside();
            defaultValues();
        })
        .fail(function(){
            alert('There was an error removing these annotations.');
        });
    } else {
        printInfo("Select at least one span to remove");
    }
}

var printInfo = function(msg){
        $("#infoMessage").html(msg);
        $("#infoMessage").removeClass("good_info");
        $("#infoMessage").addClass("bad_info");
}

var getStructuredData = function(inc){
    var type2Label={'Q132821': 'murder', 'Q168983': 'conflagration'};
    $.get('/getstrdata', {'inc': inc}, function(data, status) {
        //var data=JSON.parse(data);
        var str_html='';
        var allValues = new Set();
        var incData=inc.split('/');
        var incTypeLabel=type2Label[incData[0]] || incData[0];
        
        var incType=wdt_prefix + incData[0];
        var incId=wdt_prefix + incData[1];

        str_html += "<label id=\"incType\">incident type:</label> ";
        str_html+="<a href=\"" + incType + "\">" + incTypeLabel + "</a>";
        str_html+="<br/>";

        str_html += "<label id=\"incId\">incident ID:</label> ";
        str_html+="<a href=\"" + incId + "\">" + incId + "</a>";
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
                if ($.trim(splitted[1])=="") str_html+=valLink;
                else str_html += "<a href=\"" + valLink + "\" class=\"strLink\">" + valText + "</a>";
                allValues.add(vals[i]);
            }
            str_html+="<br/>";
        }
        $("#strinfo").html(str_html);
        var $rc = $("#referentChooser");
        $rc.empty(); // remove old options
        $rc.append($("<option value='-1' selected>-Pick referent-</option>"));
        for (let item of allValues) 
            $rc.append($("<option></option>")
            .attr("value", item.split('|')[0]).text(item));
    });
}

var addToken = function(tid, token, annotated) {
    if (token=='\n') return '<br/>';
    else {
        var shortTid=tid.split('.')[2];
        if (!annotated[shortTid]){
            return "<span id=" + tid + " class=\"clickable\">" + token + "</span> ";
        } else {
            var mwuClass="mwu";
            return "<span id=" + tid + " class=\"event_" + annotated[shortTid]['frametype'] + " unclickable " + mwuClass + "\">" + token + "</span> ";
        }
    }
}

var addTokens = function(tokens, docId, anns){
    var text = "";
    for (var token_num in tokens) {
        var token_info=tokens[token_num];
        var tokenId=docId.replace(/ /g, "_") + '.' + token_info.sent + '.' + token_info.tid;
        var newToken=addToken(tokenId, token_info.text, anns);
        text+=newToken;
    }
    return text;
}

var loadTextsFromFile = function(inc, callback){
    $("#pnlLeft").html("");
    $.get("/loadincident", {'inc': inc}, function(res, status) {
        var all_html = ""; 
        var c=0;
        var data=res['nafs'];
        console.log(data);
        for (var doc_num in data) {
            
            var docId=data[doc_num]['name'];

            console.log(data[doc_num]['annotations']);

            annotations[docId]=data[doc_num]['annotations'];
            if (Object.keys(annotations).length==data.length) callback();
            else console.log(Object.keys(annotations).length + " " + data.length);

            var title_tokens=data[doc_num]['title'];
            title=addTokens(title_tokens, docId, data[doc_num]['annotations']);

            var header = "<div class=\"panel panel-default\" id=\"" + doc_num + "\">";
            header += "<div class=\"panel-heading\"><h4 class=\"panel-title\">" + title; 
            header += "</h4></div>";

            var body = "<div class=\"panel-body\">";
            var body_tokens = data[doc_num]['body'];
            body += addTokens(body_tokens, docId, data[doc_num]['annotations']);
            body += "</div></div>";

            all_html += header + body;    
        }
        $("#pnlLeft").html(all_html);

        $("#bigdiv").height($(window).height()-($("#pickrow").height() + $("#titlerow").height()+$("#annrow").height())-20);
    });
}

var showAnnotations = function(){
    console.log('annotations' + JSON.stringify(annotations));
    $("#trails").html('');
    var html="";
    for (var key in annotations){
        html+="<b>" + key + "</b><br/>";
        for (var ann in annotations[key]){
            html+=ann + "," + annotations[key][ann]['frametype'] + "," + annotations[key][ann]['predicate'] + "," + annotations[key][ann]['reftype'] + "<br/>" ;
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
            $("#trails").html('');
            showAnnotations();
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
    $("#referentChooser").val('-1');
    $("#frameAnnotation").hide();
    $("#feAnnotation").hide();
}

var getMaxPredicateID=function(docAnnotations){
    maxId=-1;
    for (var key in docAnnotations){
        var tidAnnotation=docAnnotations[key];
        var prid=tidAnnotation['predicate'];
        var pridNum=parseInt(prid.substring(2));
        if (pridNum>maxId) maxId=pridNum;
    }
    return maxId;
}

var reloadInside=function(){
    if($("span.active").length>0){
        var actives=$(".active").map(function(){
            return $(this).attr('id');
        }).get();

        var maxPredicateId=null;
        for (var i=0; i<actives.length; i++){
            var active=actives[i];
            var elems=active.split('.');
            var docId=elems[0].replace(/_/g, ' ');
            var tid=elems[2];
            if (!maxPredicateId)
                maxPredicateId = getMaxPredicateID(annotations[docId]);
            annotations[docId][tid]={"frametype": $("#frameChooser").val(), "reftype": $("#relChooser").val(), "predicate": "pr" + (maxPredicateId+1).toString()};
            if (i==actives.length-1) showAnnotations();
        }
        var newClass = 'event_' + $("#frameChooser").val();
        $("span.active").removeClass().addClass(newClass).addClass("unclickable").addClass("mwu");
    } else if ($("span.inactive").length>0){
        $("span.inactive").children().remove();
        $("span.inactive").removeClass().addClass("clickable");
    }
}

var refreshRoles = function(theFrame){
    var relevantRoles = frame2Roles[theFrame];

    var $el = $("#roleChooser");
    $el.empty(); // remove old options
    $el.append($("<option value='-1' selected>-Pick frame role-</option>"));
    console.log("theFrame" + theFrame);
    $.each(relevantRoles, function(anIndex) {
        var unit = relevantRoles[anIndex];
        $el.append($("<option></option>")
            .attr("value", unit).text(unit));
    });
}

var storeAndReload = function(ann, anntype){
    console.log("Storing annotations");
    console.log(ann);

    $.post("/storeannotations", {'annotations': ann, 'incident': $("#pickfile").val() })
        .done(function(myData) {
            alert( "Annotation saved. Now re-loading." );
            if (anntype=='fee'){
                var pickedFrame = $("#frameChooser").val();
                $("#activeFrame").text(pickedFrame);
                var pr_id=myData['prid'];
                var doc_id = myData['docid'];
                $("#activePredicate").text(doc_id + '@' + pr_id);
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
    var sents = allMentions.map(function(x) {return x.substring(0,x.lastIndexOf('.')); });
    return allValuesSame(sents);
}

var validateAnnotation = function(anntype){
     if (anntype=='-1'){
         return [false, "Please pick an annotation type"];
    } else{
        if (anntype=='fee' & $("#frameChooser").val()=='-1'){
            return [false, "Please pick a frame"];
        } else if (anntype=='role' & $("#roleChooser").val()=='-1'){
            return [false, "Please pick a role"];
        } else if (anntype=='fee' & $("#relChooser").val()=='-1'){
            return [false, "Please pick a frame relation type"];
        } else {
            var allMentions = $(".active").map(function() {
                return $(this).attr('id');
            }).get();
            if (allMentions.length>0){
                if (!sameSentence(allMentions)) {
                    return [false, "All terms of a frame must be in the same sentence"];
                } else {
                    if (anntype=='fee'){
                        var frame = $("#frameChooser").val();
                        var reltype= $("#relChooser").val();
                        var anAnnotation = {'anntype': anntype, 'frame': frame, 'reltype': reltype, 'mentions': allMentions};
                        console.log(JSON.stringify(anAnnotation));
                    } else if (anntype=='role') {
                        var role = $('#roleChooser').val();
                        var anAnnotation = {'anntype': anntype, 'prid': $("#activePredicate").text().split('@')[1], 'mentions': allMentions, 'semRole': role, 'referent': $("#referentChooser").val()};
                    } else { //idiom
                        var anAnnotation = {'anntype': anntype, 'mentions': allMentions};
                    }
                    return [true, anAnnotation];
                }
            } else {
                return [false, "Please select at least one mention"];
            }
        }
    }
   
}

var saveFrameAnnotation = function(){
    var anntype = $("#anntype").val();
    var validation=validateAnnotation(anntype);
    var isValid=validation[0];
    if (isValid){
        console.log('storing ' + validation[1]);
        storeAndReload(validation[1], anntype);    
    } else{
        printInfo(validation[1]);
    }
}
