var express = require('express');
var app = express();
var request = require('request');
var fs = require('fs');
var xmlParser = require('fast-xml-parser');
var jsonParser = require("fast-xml-parser").j2xParser;
var LocalStrategy = require('passport-local').Strategy
var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var glob = require('glob');
var passport = require('passport');
var expressSession = require('express-session');
var mkdirp = require('mkdirp');
var _ = require('underscore');

app.use(express.static(__dirname + '/public/html'));
app.set('views', __dirname + '/public/html');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 
// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(expressSession({secret: 'mySecretKey', resave: true, saveUninitialized: false}));
app.use(passport.initialize())  
app.use(passport.session());  

var flash = require('connect-flash');
app.use(flash());

// Set paths
app.use('/', express.static('public/html'));
app.use('/js', express.static('public/js'));
app.use('/css', express.static('public/css'));
app.use('/pdf', express.static('public/assets/pdf'));
app.use('/img', express.static('public/assets/images'));
app.use('/logs', express.static('logs'));

// Settings
GUIDELINESVERSION='v1'
PORT=8787
inc2doc_file='data/inc2doc_index.json';
inc2str_file='data/inc2str_index.json';
type2inc_file='data/type2inc_index.json';
proj2inc_file='data/proj2inc_index.json';
likely_frames_file='pre_annotation/event_type_to_dominant_frame.json';
frame_info_file='pre_annotation/frame_to_info.json';
dataDir='data/naf/';
annotationDir='annotation/'

var xmlOptions = {
    attributeNamePrefix : "",
    attrNodeName: "attr", //default is 'false'
    textNodeName : "#text",
    ignoreAttributes : false,
    ignoreNameSpace : false,
    allowBooleanAttributes : false,
    parseNodeValue : false,
    parseAttributeValue : false,
    trimValues: true, // FI: to trim newlines and spaces (these are preserved with CDATA)
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    localeRange: "", //To support non english character in tag/attribute values.
    parseTrueNumberOnly: true
};

var jsonOptions = {
    attributeNamePrefix : "",
    attrNodeName: "attr", //default is false
    textNodeName : "#text",
    ignoreAttributes : false,
    cdataTagName: "__cdata", //default is false
    cdataPositionChar: "\\c",
    format: true,
    indentBy: "",
    supressEmptyNode: true,
};

// Files
fs.readFile(inc2doc_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    inc2doc = JSON.parse(data);
});

fs.readFile(inc2str_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    inc2str = JSON.parse(data);
});

fs.readFile(proj2inc_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    proj2inc = JSON.parse(data);
});

fs.readFile(type2inc_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    type2inc = JSON.parse(data);
});

fs.readFile(likely_frames_file, 'utf8', function (err, data){
    if (err) throw err; // we'll not consider error handling for now
    likelyFrames = JSON.parse(data);
});

fs.readFile(frame_info_file, 'utf8', function (err, data){
    if (err) throw err; // we'll not consider error handling for now
    allFramesInfo = JSON.parse(data);
});

// =====================================
// ROUTING FUNCTIONS ===================
// =====================================

app.get('/', function(req, res){
    res.sendFile('index.html', {root:'./public/html'});
    });

app.get('/dash', isAuthenticated, function(req, res){
    res.render('dash.html', { username: req.user.user });
});

app.get('/annotation', isAuthenticated, function(req, res){
    res.render('annotation.html', { username: req.user.user });
});

// =====================================
// PASSPORT FUNCTIONS ==================
// =====================================

passport.use(new LocalStrategy(
  function(username, password, done) {
    fs.readFile('allowed.json', 'utf8', function (err, data) {
        if (err) throw err; // we'll not consider error handling for now
        var allowed = JSON.parse(data);
        if (allowed[username] && allowed[username]==password){
            done(null, { user: username });
        }
        else
        {
            done(null, false);
        }
   });
}));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

/* Handle Login POST */
app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/' }),
  function(req, res) {
    req.session.visited = new Date().toISOString().replace(/\..+/, '');
    //res.redirect('/dash');
    //logAction(req.user.user, "LOGIN");
    res.sendStatus(200);
  });

app.get('/logout', function(req, res) {
//    logAction(req.user.user, "LOGOUT");
    req.session.destroy();

    req.logout();
    res.redirect('/');
});

// =====================================
// AUTH UTILS ==========================
// =====================================

var isAdmin = function (u){
    return (['piek', 'roxane', 'filip', 'marten'].indexOf(u)>-1);
}

// route middleware to make sure a user is logged in
function isAuthenticated(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}

// =====================================
// QUERY UTILS =========================
// =====================================

var getTokenData = function(tokens){
    var tokenData={};
    for (var i=0; i<tokens.length; i++){
        var token=tokens[i];
        //var txt=token['#text'];
        var tid=token['attr']['id'];
        var sent=token['attr']['sent'];
        tokenData[tid]={'sent': sent, 'text': token['__cdata']};
    }
    return tokenData;
}

/*
var getAnnotatedRolesForPredicate=function(srl_data, the_id, callback){
    var result={};
    if (!srl_data || srl_data.length==0)
        callback(result);
    if (!(Array.isArray(srl_data))) srl_data=[srl_data];
    for (var i=0; i<srl_data.length; i++){
        var pr = srl_data[i];
        var pr_id=pr['attr']['id'];
        if (pr_id!=the_id) continue;
        if (!(pr[i]['role'])) callback(result);
        var roles=pr[i]['role'];
        for (var role_i=0; role_i<roles.length; role_i++){
            var role=roles[role_i];
            var targets=role['span']['target'];
            if (!(Array.isArray(targets))) targets=[targets];
            
            var extRefs = role['externalReferences']['externalRef'];
            var roleType='';
            if (!(Array.isArray(extRefs)))
                roleType = extRefs['attr']['reference'].split('@')[1];
            else{
                extRefs.forEach(function(extRef){
                    if (extRef['attr']['reftype']=='type')
                        roleType=extRef['attr']['reference'].split('@')[1];
                });
            }
            for (var j=0; j<targets.length; j++){
                var tid=targets[j];
                var tidEntry = roleType;
                result[tid]=tidEntry;
                if (j+1==targets.length){
                    callback(result);
                }
            }
        }
    }    
});
*/

var prepareAnnotations = function(srl_data, callback){
    var result={};
    if (!srl_data || srl_data.length==0)
        callback(result);
    if (!(Array.isArray(srl_data))) srl_data=[srl_data];

    var done_i=0;
    for (var i=0; i<srl_data.length; i++){
        var pr = srl_data[i];
        var pr_id=pr['attr']['id'];
        var extRefs = pr['externalReferences']['externalRef'];
        console.log(JSON.stringify(extRefs));
        var ftype='';
        if (extRefs){
            if (!(Array.isArray(extRefs)))
                ftype = extRefs['attr']['reference'];
            else{
                extRefs.forEach(function(extRef){
                    if (extRef['attr']['reftype']=='type')
                        ftype=extRef['attr']['reference'];
                });
            }
        }
        var targets=pr['span']['target'];
        if (!(Array.isArray(targets))) targets=[targets];

        for (var j=0; j<targets.length; j++){
            var tid=targets[j]['attr']['id'];
            var tidEntry = {'frametype': ftype, 'predicate': pr_id};
            result[tid]=tidEntry;
            if (j+1==targets.length){
                done_i++;
                if (done_i==srl_data.length) {
                    callback(result);
                }
            }
        }
    }
}

function loadNAFFile(nafName, theUser, adaptJson, callback){
    var filename=annotationDir + theUser + '/' + nafName + '.naf';
    if (!(fs.existsSync(filename))){
        var filename=dataDir + nafName + '.naf';
    }
    console.log(filename);
    fs.readFile(filename, 'utf-8', function(err, xmlData) {
        if (err) {
            console.error(err);
        }

        var jsonObj = xmlParser.parse(xmlData, xmlOptions);

        if (adaptJson){
            var tokens = jsonObj['NAF']['text']['wf'];
            var tokenData = getTokenData(tokens);

            var terms = jsonObj['NAF']['terms']['term'];
            var srl=[];
            if (jsonObj['NAF']['srl'])
                srl=jsonObj['NAF']['srl']['predicate'];
            var termData = {};

            var ready_title_terms=[];
            var ready_body_terms=[];

            var wikiTitle=jsonObj['NAF']['nafHeader']['public']['attr']['uri'];
            if (!wikiTitle)
                console.log(jsonObj);
            for (var i=0; i<terms.length; i++){
                var term=terms[i];

                var termId=term['attr']['id'];

                var targets=[term['span']['target']];
                var components=term['component'];
                if (components){
                    for (var c=0; c<components.length; c++){
                        var comp=components[c];
                        var compId=comp['attr']['id'];
                        var lemma=comp['attr']['lemma'];
                        var tokenId=targets[0]['attr']['id'];
                        var sent=tokenData[tokenId]['sent'];
                        var termData={'text': lemma, 'tid': compId, 'sent': sent}; 
                        if (sent=='1') ready_title_terms.push(termData);
                        else ready_body_terms.push(termData);
                    }
                } else {
                    var termTokens=[];
                    for (var t=0; t<targets.length; t++){
                        var target=targets[t];
                        var targetId=target['attr']['id'];
                        var targetInfo=tokenData[targetId];
                        var sent=targetInfo['sent'];
                        termTokens.push(targetInfo['text']);
                    }
                    var termData={'text': termTokens.join(' '), 'tid': termId, 'sent': sent};
                    if (sent=='1') ready_title_terms.push(termData);
                    else ready_body_terms.push(termData);
                }
                if (i==terms.length-1){
                    console.log(i + ' is at the end. Prepare annotations for this file. Srl:');
                    prepareAnnotations(srl, function(ready_srl){
                        console.log('All annotations ready');
                        callback({'title': ready_title_terms, 'body': ready_body_terms, 'name': nafName, 'annotations': ready_srl, 'source': wikiTitle, 'sourcetype': wikiTitle.includes('wikipedia') ? "secondary" : "primary"});
                    });
                }
            }
        } else {
            callback(jsonObj);
        }
    });
}

var loadAllNafs = function(nafs, theUser, callback){
    var data=[];
    console.log(nafs); 
    for (var i=0; i<nafs.length; i++){
        loadNAFFile(nafs[i], theUser, true, function(nafData){
            data.push(nafData);
            if (data.length==nafs.length) callback(data);
        });
    }
}

var makeSpanLayer = function(anObj, tids){
    anObj['span']={'#text': '', 'target': []};
    for (var i=0; i<tids.length; i++){
        var tid=tids[i].split('.')[2];
        anObj['span']['target'].push({'#text': '', 'attr':{'id': tid}});
    }
    return anObj['span'];
}

var saveSessionInfo = function(jsonData, sessionId, annotator, loginTime){
    var actionTime=new Date().toISOString().replace(/\..+/, '');
    var nafHeaders=jsonData['NAF']['nafHeader'];
    var lps=nafHeaders['linguisticProcessors'];
    for (var l=0; l<lps.length; l++){
        var lp=lps[l];
        if (lp['attr']['layer']=='srl'){ // SRL layer exists
            if (!(Array.isArray(lp['lp']))) var processes=[lp['lp']];
            else var processes=lp['lp'];

            for (var p=0; p<processes.length; p++){
                var process=processes[p];
                var processId=process['attr']['id'];
                if (processId==sessionId){ // session exists -> update it
                    process['attr']['endTimestamp']=actionTime;
                    return jsonData;
                } else if (p==processes.length-1){ // we don't have this session yet -> store it
                    var currentProcess={'attr': {'beginTimestamp': loginTime, 'endTimestamp': actionTime, 'name': 'annotator_' + annotator, 'version': 'guidelines_' + GUIDELINESVERSION, 'id': sessionId}};
                    processes.push(currentProcess);
                    lp['lp']=processes;
                    return jsonData;
                }
            }
        } else if (l==lps.length-1){
            var processes=[];
            srl_lp={'attr': {'layer': 'srl'}};
            lps.push(srl_lp);
            var currentProcess={'attr': {'beginTimestamp': loginTime, 'endTimestamp': actionTime, 'name': 'annotator_' + annotator, 'version': 'guidelines_' + GUIDELINESVERSION, 'id': sessionId}};
            processes.push(currentProcess);
            srl_lp['lp']=processes;
            return jsonData;
        }
    }
}

var formatTime = function(rawDate){
    return rawDate.toISOString().replace(/\..+/, '');
}

var annotateFrame=function(jsonData, annotations, sessionId){
    var frame = annotations['frame'];
    var reftype = annotations['reltype'];
    var tids = annotations['mentions'];
    var referents= annotations['referents'];
    if (!('srl' in jsonData['NAF'])){
        jsonData['NAF']['srl']={};
        jsonData['NAF']['srl']['#text']='';
        jsonData['NAF']['srl']['predicate']=[];
        var pr_id="pr1";
    } else {
        var thePredicates=jsonData['NAF']['srl']['predicate'];
        if (!(Array.isArray(thePredicates))) thePredicates=[thePredicates];
        var pr_num=(parseInt(thePredicates[thePredicates.length-1]['attr']['id'].substring(2)) || 0) + 1;
        var pr_id="pr" + pr_num;
    }
    var aPredicate = {};
    aPredicate['#text']='';
    aPredicate['attr']={};
    aPredicate['attr']['id']=pr_id;
    aPredicate['externalReferences']={'#text': '', 'externalRef': []};
    if (frame!='none')
        aPredicate['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': frame, 'resource': 'FrameNet', 'source': sessionId, 'reftype': 'type'}});
    if (referents && referents.length>0)
        referents.forEach(function(ref){
            aPredicate['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': ref, 'resource': 'Wikidata', 'source': sessionId, 'reftype': reftype}});
        });
    aPredicate['span']=makeSpanLayer(aPredicate, tids);
    
    aPredicate['role']=[];
    var predicates=jsonData['NAF']['srl']['predicate'];
    if (!(Array.isArray(predicates))){
        jsonData['NAF']['srl']['predicate']=[]
        jsonData['NAF']['srl']['predicate'].push(predicates);
    }
    jsonData['NAF']['srl']['predicate'].push(aPredicate);

    return {'prid': pr_id, 'json': jsonData};
}

var annotateRole=function(jsonData, annotations, sessionId){
    var roleData = annotations;
    if ('srl' in jsonData['NAF']){
        var predicates=jsonData['NAF']['srl']['predicate'];
        if (!Array.isArray(predicates))
            predicates=[predicates];
        for (var i=0; i<predicates.length; i++){
            console.log('is predicate ok if the id is ' + predicates[i]['attr']['id']);
            if (predicates[i]['attr']['id']==roleData['prid']){
                console.log('Enriching role with id ' + roleData['prid']);
                if (!('role' in predicates[i]))
                    predicates[i]['role']=[];
                else if (!(Array.isArray(predicates[i]['role'])))
                    predicates[i]['role']=[predicates[i]['role']];
                var existingRoles=predicates[i]['role'];
                var aRole={};
                aRole['#text']='';
                aRole['attr']={}
                aRole['attr']['id']='rl' + (existingRoles.length + 1).toString();
                aRole['span']=makeSpanLayer(aRole, roleData['mentions']);
                var referents= roleData['referents'];
                var semRole=roleData['semRole'];
                aRole['externalReferences']={'#text': '', 'externalRef': []};
                aRole['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': semRole, 'resource': 'FrameNet', 'source': sessionId, 'reftype': 'type'}});
                aRole['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': semRole.split('@')[0], 'resource': 'FrameNet', 'source': sessionId, 'reftype': 'evoke'}});
                if (referents && referents.length>0)

                    referents.forEach(function(ref){
                        aRole['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': ref, 'resource': 'Wikidata', 'source': sessionId, 'reftype': 'reference'}});
                    });
                predicates[i]['role'].push(aRole);
                break;
            }
        }
        return {'prid': roleData['prid'], 'json': jsonData};
    } else{
        return {'prid': roleData['prid'], 'json': jsonData};
    }
}

var addAnnotationsToJson = function(jsonData, annotations, sessionId){
    if (annotations['anntype']=='idiom'){  
        return jsonData;
    } else if (annotations['anntype']=='fee'){
        return annotateFrame(jsonData, annotations, sessionId);
    } else{ // Role
        return annotateRole(jsonData, annotations, sessionId);
    }
}

var saveNAFAnnotation = function(userAnnotationFile, updatedJson, callback){
    var parser = new jsonParser(jsonOptions);
    var xml = parser.parse(updatedJson);
    fs.writeFile(userAnnotationFile, xml, function(err, data) {
        if (err) {
            console.log(err);
            callback(err);
        }
        else {
            console.log('updated!');
            callback(false);
        }
  });
}

// =====================================
// QUERY ENDPOINTS =====================
// =====================================

app.get('/listprojectsandtypes', isAuthenticated, function(req, res){
    var projects=Object.keys(proj2inc);
    var types=Object.keys(type2inc);
    res.send({'proj': Array.from(projects), 'types': Array.from(types)});
});

app.get('/listincidents', isAuthenticated, function(req, res){
    var aType=req.query['mytype'];
    var aProj=req.query['myproj'];
    var incWithDocs=Object.keys(inc2doc);
    var incOfType=Array.from(type2inc[aType]);
    var incOfProj=Array.from(proj2inc[aProj]);
    var selected=_.intersection(incWithDocs, incOfType, incOfProj);
    res.send({'new': Array.from(selected), 'old': []});
});

app.get('/loadincident', isAuthenticated, function(req, res){
    if (!req.query['inc'] || !req.query['etype']){
        res.sendStatus(400);//("Not OK: incident id not specified");
    } else{
        var incidentId = req.query['inc'];
        var eventType = req.query['etype']
        var nafs=inc2doc[incidentId];
        loadAllNafs(nafs, req.user.user, function(data){
            console.log("All nafs loaded. returning the result now");
            console.log(likelyFrames[eventType]['lu_to_dominant_frame']);
            res.send({'nafs': data, 'lus': likelyFrames[eventType]['lu_to_dominant_frame']});
        });
    }
});

app.get('/loadframes', isAuthenticated, function(req, res){
    if (!req.query['eventtype']){
        res.sendStatus(400);
    } else{
        var etype = req.query['eventtype'];
        var likelyIdsForEvent = likelyFrames[etype]["main_frame_ids"];
        var allFrames = Object.keys(allFramesInfo);
        var otherFrameIds = _.difference(allFrames, likelyIdsForEvent);
        var likelyLabels=[];
        var otherLabels=[];
        for (var frameId in allFramesInfo){
            var frameInfo = allFramesInfo[frameId];
            if (likelyIdsForEvent.indexOf(parseInt(frameId))!=-1)
                likelyLabels.push(frameInfo['frame_label']);
            else
                otherLabels.push(frameInfo['frame_label']);
        }
        res.send({'likely': likelyLabels.sort(), 'other': otherLabels.sort()});
    }
});

app.post('/storeannotations', isAuthenticated, function(req, res){
    var thisUser=req.user.user;
    var loginTime = req.session.visited;
    console.log("Storing request received from " + thisUser);
    if (req.body.incident){
	    var annotations = req.body.annotations || {};
        var firstMention=annotations['mentions'][0];
        var docidAndTid = firstMention.split('.');
        var docId=docidAndTid[0].replace(/_/g, " ");
        loadNAFFile(docId, req.user.user, false, function(nafData){
            var userAnnotationDir=annotationDir + thisUser + "/";

            var langAndTitle=docId.split('/');
            var lang=langAndTitle[0];
            var title=langAndTitle[1];

            var userAnnotationDirLang = userAnnotationDir + lang + '/';

            mkdirp(userAnnotationDirLang, function (err) {
                if (err) console.error('Error with creating a directory' + err);
                else {
                    var userAnnotationFile=userAnnotationDirLang + title + '.naf';
                    console.log('File ' + docId + ' loaded. Now updating and saving.');
                    var newData = addAnnotationsToJson(nafData, annotations, req.sessionID);
                    var updatedJson=saveSessionInfo(newData['json'], req.sessionID, thisUser, loginTime);
                    var pr_id=newData['prid'];
                    saveNAFAnnotation(userAnnotationFile, updatedJson, function(error){
                        console.log('Error obtained with saving: ' + error);
                        if (error){
                            res.status(400).json({'error': error});
                        } else {
                            console.log('Sending response with predicate ID ' + pr_id);
                            res.send({'prid': pr_id, 'docid': docId});
                        }
                    });
                }
            });
        });
    } else {
        console.error("Storing of annotations: incident not specified - user " + thisUser);
        res.sendStatus(400);//("Not OK: incident id not specified");
    }
});

app.get('/getstrdata', isAuthenticated, function(req, res){
    var inc = req.query['inc'];
    var jsonResult=inc2str[inc];
    res.send(jsonResult);
});

// =====================================
// START THE SERVER! ===================
// =====================================
    //
app.listen(PORT, function() {
	console.log('started annotation tool nodejs backend on port ' + PORT);
});

module.exports = app;
