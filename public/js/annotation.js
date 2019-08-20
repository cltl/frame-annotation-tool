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
            //$("#feAnnotation").show();
            $("#frameAnnotation").show();
	    } else {
            //$("#feAnnotation").hide();
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
}); // This is where the load function ends!

var clearSelection = function(){
    $('span').removeClass("active");
    $('span').removeClass("inactive");
}

var printInfo = function(msg){
        $("#infoMessage").html(msg);
        $("#infoMessage").removeClass("good_info");
        $("#infoMessage").addClass("bad_info");
}

var getStructuredData = function(inc){
    // TODO: DEFINE THIS!
    $.get('/getstrdata', {'inc': inc}, function(data, status) {
        //var data=JSON.parse(data);
        var str_html='';
        for (var property in data) {
            var vals=data[property];
            var clean_property=property.split(':')[1];
            str_html += "<label id=\"strloc\">" + clean_property + ":</label> ";
            for (var i=0; i<vals.length; i++){
                var splitted=vals[i].split('|');
                if (i>0) str_html += ", ";
                var valText=splitted[1];
                if ($.trim(splitted[1])=="") str_html+=splitted[0];
                else str_html += "<a href=\"" + splitted[0] + "\">" + valText + "</a>";
            }
            str_html+="<br/>";
        }
        $("#strinfo").html(str_html);

    });
}

var addToken = function(tid, token, annotated) {
    if (token=='\n') return '<br/>';
    else {
        if (!annotated[tid]){
            return "<span id=" + tid + " class=\"clickable\">" + token + "</span> ";
        } else return ""; 
    }
    
}

var addTokens = function(tokens, docId){
    var text = "";
    for (var token_num in tokens) {
        var token_info=tokens[token_num];
        var tokenId=docId.replace(/ /g, "_") + '.' + token_info.sent + '.' + token_info.tid;
        var newToken=addToken(tokenId, token_info.text, {});
        text+=newToken;
    }
    return text;
}

var loadTextsFromFile = function(inc){
    $("#pnlLeft").html("");
    $.get("/loadincident", {'inc': inc}, function(res, status) {
        var all_html = ""; 
        var c=0;
        var data=res['nafs'];
        for (var doc_num in data) {
            var docId=data[doc_num]['name'];

            var title_tokens=data[doc_num]['title'];
            title=addTokens(title_tokens, docId);

            var header = "<div class=\"panel panel-default\" id=\"" + doc_num + "\">";
            header += "<div class=\"panel-heading\"><h4 class=\"panel-title\">" + title; 
            header += "</h4></div>";

            var body = "<div class=\"panel-body\">";
            var body_tokens = data[doc_num]['body'];
            body += addTokens(body_tokens, docId);
            body += "</div></div>";

            all_html += header + body;    
        }
        $("#pnlLeft").html(all_html);

        $("#bigdiv").height($(window).height()-($("#pickrow").height() + $("#titlerow").height()+$("#annrow").height())-20);
    });
}

// Load incident - both for mention and structured annotation
var loadIncident = function(){
    var inc = $("#pickfile").val();
    if (inc!="-1"){
        $("#incid").html(inc);
        $("#infoMessage").html("");
        getStructuredData(inc);
        loadTextsFromFile(inc);
        $("#annrow").show();
        $("#bigdiv").show();
        $("#frameAnnotation").hide();
        $("#feAnnotation").hide();
    } else{
        printInfo("Please select an incident");
    }
}

// SAVE ANNOTATION

var storeAndReload = function(ann){
    console.log("Storing annotations");
    console.log(ann);

    $.post("/storeannotations", {'annotations': ann, 'incident': $("#pickfile").val() })
        .done(function() {
            alert( "Annotation saved. Now re-loading." );
            // reloadInside(mwu);
            //defaultValues();
            //showTrails();
        })
    .fail(function() {
        alert( "There was an error with storing these annotations" );
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

var validateAnnotation = function(){
     if ($("#anntype").val()=='-1'){
         return [false, "Please pick an annotation type"];
    } else{
        var anntype = $("#anntype").val();
        if (anntype=='fee' & $("#frameChooser").val()=='-1'){
            return [false, "Please pick a frame"];
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
                        var anAnnotation = {'anntype': anntype, 'frame': frame, 'mentions': allMentions};
                    } else {
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
    var validation=validateAnnotation();
    var isValid=validation[0];
    if (isValid){
        storeAndReload(validation[1]);    
    } else{
        printInfo(validation[1]);
    }
}
